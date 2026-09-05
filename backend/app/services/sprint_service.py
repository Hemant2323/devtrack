"""Sprint business rules (FR-5).

Authorization mirrors project_service: reads are open to any project member,
mutations require ADMIN, and an archived project rejects every write. Callers
who are not members receive 404 rather than 403, matching the existing
existence-hiding convention.
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.issue import Sprint, SprintState, Status
from app.models.project import Role
from app.models.user import User
from app.repositories import activity_repo, project_repo, sprint_repo
from app.schemas.sprint import SprintCreate, SprintReport, SprintResponse, SprintUpdate


# ---------- helpers ----------


def _get_project_or_404(db: Session, project_id: int, caller: User):
    project = project_repo.get_by_id(db, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    if project_repo.get_member(db, project_id, caller.id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return project


def _require_admin(db: Session, project_id: int, caller: User) -> None:
    member = project_repo.get_member(db, project_id, caller.id)
    if member is None or member.role != Role.ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin role required")


def _require_not_archived(project) -> None:
    if project.archived:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Project is archived")


def _get_sprint_or_404(db: Session, sprint_id: int, caller: User) -> tuple[Sprint, object]:
    """Return (sprint, project), or 404 if it does not exist or the caller is
    not a member of its project."""
    sprint = sprint_repo.get_by_id(db, sprint_id)
    if sprint is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sprint not found")
    project = _get_project_or_404(db, sprint.project_id, caller)
    return sprint, project


# ---------- reads ----------


def list_sprints(db: Session, project_id: int, caller: User) -> list[Sprint]:
    _get_project_or_404(db, project_id, caller)
    return sprint_repo.list_for_project(db, project_id)


def get_sprint(db: Session, sprint_id: int, caller: User) -> Sprint:
    sprint, _ = _get_sprint_or_404(db, sprint_id, caller)
    return sprint


# ---------- writes ----------


def create_sprint(db: Session, project_id: int, data: SprintCreate, caller: User) -> Sprint:
    """FR-5.1 — an Admin creates a sprint. New sprints start PLANNED."""
    project = _get_project_or_404(db, project_id, caller)
    _require_admin(db, project_id, caller)
    _require_not_archived(project)
    return sprint_repo.create(db, project_id, **data.model_dump())


def update_sprint(db: Session, sprint_id: int, data: SprintUpdate, caller: User) -> Sprint:
    sprint, project = _get_sprint_or_404(db, sprint_id, caller)
    _require_admin(db, sprint.project_id, caller)
    _require_not_archived(project)

    if sprint.state == SprintState.COMPLETED:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "A completed sprint can no longer be edited"
        )

    changes = data.model_dump(exclude_unset=True)
    if not changes:
        return sprint

    # Validate the resulting pair, not just the supplied one: patching only
    # end_date must still not produce a sprint that ends before it starts.
    start = changes.get("start_date", sprint.start_date)
    end = changes.get("end_date", sprint.end_date)
    if start and end and end < start:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "end_date must not be earlier than start_date",
        )

    return sprint_repo.update(db, sprint, **changes)


def start_sprint(db: Session, sprint_id: int, caller: User) -> Sprint:
    """PLANNED -> ACTIVE, enforcing FR-5.3: one active sprint per project."""
    sprint, project = _get_sprint_or_404(db, sprint_id, caller)
    _require_admin(db, sprint.project_id, caller)
    _require_not_archived(project)

    if sprint.state == SprintState.ACTIVE:
        raise HTTPException(status.HTTP_409_CONFLICT, "Sprint is already active")
    if sprint.state == SprintState.COMPLETED:
        raise HTTPException(status.HTTP_409_CONFLICT, "A completed sprint cannot be restarted")

    active = sprint_repo.get_active(db, sprint.project_id)
    if active is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"'{active.name}' is already active — complete it before starting another",
        )

    sprint_repo.set_state(db, sprint, SprintState.ACTIVE)
    db.commit()
    db.refresh(sprint)
    return sprint


def complete_sprint(db: Session, sprint_id: int, caller: User) -> SprintReport:
    """ACTIVE -> COMPLETED (FR-5.4).

    Unfinished issues return to the backlog (sprint_id = NULL) and the
    completed-vs-planned report is produced. The state change and every issue
    move happen in one transaction, so a sprint can never end up completed
    with its unfinished work still attached.

    Each returned issue gets an activity row, because FR-6.2/NFR-10 require
    every change to an issue to be traceable — including this one.
    """
    sprint, project = _get_sprint_or_404(db, sprint_id, caller)
    _require_admin(db, sprint.project_id, caller)
    _require_not_archived(project)

    if sprint.state == SprintState.COMPLETED:
        raise HTTPException(status.HTTP_409_CONFLICT, "Sprint is already completed")
    if sprint.state != SprintState.ACTIVE:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Only an active sprint can be completed"
        )

    issues = sprint_repo.list_issues(db, sprint.id)
    planned = len(issues)
    unfinished = [issue for issue in issues if issue.status != Status.DONE]

    for issue in unfinished:
        activity_repo.log(
            db,
            issue.id,
            caller.id,
            action="field_changed",
            field="sprint_id",
            old_value=str(sprint.id),
            new_value=None,
        )
        issue.sprint_id = None

    sprint_repo.set_state(db, sprint, SprintState.COMPLETED)
    db.commit()
    db.refresh(sprint)

    return SprintReport(
        sprint=SprintResponse.model_validate(sprint),
        planned=planned,
        completed=planned - len(unfinished),
        returned_to_backlog=len(unfinished),
        returned_issue_ids=[issue.id for issue in unfinished],
    )


# ---------- used by issue_service ----------


def validate_assignable(db: Session, project_id: int, sprint_id: int | None) -> None:
    """Guard for assigning an issue to a sprint (FR-5.2).

    An issue may only join a sprint that exists, belongs to the same project,
    and has not been completed. Without this, PATCH /issues/{id} would happily
    attach an issue to another project's sprint.
    """
    if sprint_id is None:
        return
    sprint = sprint_repo.get_by_id(db, sprint_id)
    if sprint is None or sprint.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sprint not found")
    if sprint.state == SprintState.COMPLETED:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Cannot move issues into a completed sprint"
        )
