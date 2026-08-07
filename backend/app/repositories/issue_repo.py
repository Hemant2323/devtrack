"""All database queries for issues."""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.issue import Issue, Status


def get_by_id(db: Session, issue_id: int) -> Issue | None:
    """Returns the issue only if it is not soft-deleted."""
    issue = db.get(Issue, issue_id)
    if issue and issue.deleted_at is not None:
        return None
    return issue


def list_for_project(
    db: Session,
    project_id: int,
    *,
    status: Status | None = None,
    type_: str | None = None,
    priority: str | None = None,
    assignee_id: int | None = None,
    sprint_id: int | None = None,
    q: str | None = None,
    include_backlog: bool = True,
) -> list[Issue]:
    stmt = (
        select(Issue)
        .where(Issue.project_id == project_id, Issue.deleted_at.is_(None))
        .order_by(Issue.created_at.desc())
    )
    if status:
        stmt = stmt.where(Issue.status == status)
    if type_:
        stmt = stmt.where(Issue.type == type_)
    if priority:
        stmt = stmt.where(Issue.priority == priority)
    if assignee_id is not None:
        stmt = stmt.where(Issue.assignee_id == assignee_id)
    if sprint_id is not None:
        stmt = stmt.where(Issue.sprint_id == sprint_id)
    if not include_backlog:
        stmt = stmt.where(Issue.sprint_id.is_not(None))
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            Issue.title.ilike(pattern) | Issue.description.ilike(pattern)
        )
    return list(db.scalars(stmt))


def create(db: Session, project_id: int, number: int, reporter_id: int, **fields) -> Issue:
    issue = Issue(project_id=project_id, number=number, reporter_id=reporter_id, **fields)
    db.add(issue)
    # Don't commit here — caller handles commit after logging activity
    db.flush()
    return issue


def update(db: Session, issue: Issue, **fields) -> Issue:
    for k, v in fields.items():
        setattr(issue, k, v)
    # Don't commit here — caller logs activity then commits
    db.flush()
    return issue


def soft_delete(db: Session, issue: Issue) -> None:
    issue.deleted_at = datetime.now(timezone.utc)
    db.flush()
