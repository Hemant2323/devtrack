"""All database queries for sprints."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.issue import Issue, Sprint, SprintState


def get_by_id(db: Session, sprint_id: int) -> Sprint | None:
    return db.get(Sprint, sprint_id)


def list_for_project(db: Session, project_id: int) -> list[Sprint]:
    """Newest first, matching the ordering convention used for issues."""
    return list(
        db.scalars(
            select(Sprint)
            .where(Sprint.project_id == project_id)
            .order_by(Sprint.created_at.desc())
        )
    )


def get_active(db: Session, project_id: int) -> Sprint | None:
    """The project's ACTIVE sprint, if any.

    The "one active sprint per project" rule (FR-5.3) is enforced in the
    service layer using this lookup — a DB-level partial unique index would be
    cleaner but needs PostgreSQL syntax that will not run on SQLite, which is
    the reason recorded on the Sprint model itself.
    """
    return db.scalar(
        select(Sprint).where(
            Sprint.project_id == project_id,
            Sprint.state == SprintState.ACTIVE,
        )
    )


def create(db: Session, project_id: int, **fields) -> Sprint:
    sprint = Sprint(project_id=project_id, **fields)
    db.add(sprint)
    db.commit()
    db.refresh(sprint)
    return sprint


def update(db: Session, sprint: Sprint, **fields) -> Sprint:
    for key, value in fields.items():
        setattr(sprint, key, value)
    db.commit()
    db.refresh(sprint)
    return sprint


def set_state(db: Session, sprint: Sprint, state: SprintState) -> Sprint:
    """Change lifecycle state without committing — the caller commits so a
    completion can move issues in the same transaction."""
    sprint.state = state
    db.flush()
    return sprint


def list_issues(db: Session, sprint_id: int) -> list[Issue]:
    """Live issues currently assigned to the sprint."""
    return list(
        db.scalars(
            select(Issue).where(
                Issue.sprint_id == sprint_id,
                Issue.deleted_at.is_(None),
            )
        )
    )
