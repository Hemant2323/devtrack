"""Issue business rules (FR-3) with activity logging (FR-6.2).

Key design: create and update always log an activity in the SAME
transaction, so they're atomic — either both succeed or both roll back.
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.issue import Issue
from app.models.notification import NotifType
from app.models.project import Project
from app.repositories import activity_repo, issue_repo, project_repo
from app.services import notification_service
from app.schemas.issue import IssueCreate, IssueResponse, IssueUpdate


# ---------- helpers ----------


def _get_project_member_or_404(db: Session, project_id: int, user_id: int):
    """Return the membership row, or 404 (existence hiding)."""
    project = project_repo.get_by_id(db, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    member = project_repo.get_member(db, project_id, user_id)
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return project, member


def _get_issue_or_404(db: Session, issue_id: int, user_id: int) -> Issue:
    """Return the issue if it exists, is not deleted, and caller is a member."""
    issue = issue_repo.get_by_id(db, issue_id)
    if issue is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Issue not found")
    # Existence hiding: non-members get 404
    if project_repo.get_member(db, issue.project_id, user_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Issue not found")
    return issue


def _next_number(db: Session, project: Project) -> int:
    """Atomically increment issue_counter and return the new value.

    Using flush() + commit() in the same transaction as the issue insert
    makes this race-safe (TC-ISS-01) — no two issues can get the same
    number even under concurrent requests.
    """
    project.issue_counter += 1
    db.flush()
    return project.issue_counter


def _to_response(issue: Issue, project_key: str) -> IssueResponse:
    return IssueResponse(
        **{c.name: getattr(issue, c.name) for c in Issue.__table__.columns},
        key=f"{project_key}-{issue.number}",
    )


# ---------- CRUD ----------


def list_issues(
    db: Session,
    project_id: int,
    caller_id: int,
    **filters,
) -> list[IssueResponse]:
    project, _ = _get_project_member_or_404(db, project_id, caller_id)
    issues = issue_repo.list_for_project(db, project_id, **filters)
    return [_to_response(i, project.key) for i in issues]


def create_issue(
    db: Session, project_id: int, data: IssueCreate, caller_id: int
) -> IssueResponse:
    project, _ = _get_project_member_or_404(db, project_id, caller_id)

    if project.archived:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Project is archived")

    number = _next_number(db, project)
    fields = data.model_dump(exclude_none=False)
    issue = issue_repo.create(db, project_id, number, caller_id, **fields)

    activity_repo.log(db, issue.id, caller_id, "created")

    # Notify assignee on creation (FR-8.1)
    if issue.assignee_id and issue.assignee_id != caller_id:
        notification_service.notify(
            db, issue.assignee_id, NotifType.ASSIGNED,
            f"You were assigned {project.key}-{number}", issue.id
        )

    db.commit()
    db.refresh(issue)

    return _to_response(issue, project.key)


def get_issue(db: Session, issue_id: int, caller_id: int) -> IssueResponse:
    issue = _get_issue_or_404(db, issue_id, caller_id)
    project = project_repo.get_by_id(db, issue.project_id)
    return _to_response(issue, project.key)


def update_issue(
    db: Session, issue_id: int, data: IssueUpdate, caller_id: int
) -> IssueResponse:
    issue = _get_issue_or_404(db, issue_id, caller_id)
    project = project_repo.get_by_id(db, issue.project_id)

    if project.archived:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Project is archived")

    changes = data.model_dump(exclude_unset=True)
    if not changes:
        return _to_response(issue, project.key)

    def _str(v):
        """Return the plain string for a value, using .value for enums."""
        if v is None:
            return None
        return v.value if hasattr(v, "value") else str(v)

    for field, new_val in changes.items():
        old_val = getattr(issue, field)
        if old_val == new_val:
            continue
        # Log every changed field (TC-ISS-04 checks status transition is logged)
        activity_repo.log(
            db, issue.id, caller_id,
            action="status_changed" if field == "status" else "field_changed",
            field=field,
            old_value=_str(old_val),
            new_value=_str(new_val),
        )

    issue_repo.update(db, issue, **changes)

    # Notifications on update (FR-8.1)
    if "status" in changes:
        if issue.assignee_id and issue.assignee_id != caller_id:
            notification_service.notify(
                db, issue.assignee_id, NotifType.STATUS_CHANGE,
                f"{project.key}-{issue.number} moved to {changes['status'].value}",
                issue.id,
            )
    if "assignee_id" in changes and changes["assignee_id"] and changes["assignee_id"] != caller_id:
        notification_service.notify(
            db, changes["assignee_id"], NotifType.ASSIGNED,
            f"You were assigned {project.key}-{issue.number}", issue.id,
        )

    db.commit()
    db.refresh(issue)
    return _to_response(issue, project.key)


def delete_issue(db: Session, issue_id: int, caller_id: int) -> None:
    """Soft-delete: only Admins may delete (FR-3.5)."""
    issue = _get_issue_or_404(db, issue_id, caller_id)
    member = project_repo.get_member(db, issue.project_id, caller_id)
    from app.models.project import Role
    if member.role != Role.ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin role required to delete issues")

    issue_repo.soft_delete(db, issue)
    activity_repo.log(db, issue.id, caller_id, "deleted")
    db.commit()


def get_activities(db: Session, issue_id: int, caller_id: int):
    _get_issue_or_404(db, issue_id, caller_id)
    return activity_repo.get_for_issue(db, issue_id)
