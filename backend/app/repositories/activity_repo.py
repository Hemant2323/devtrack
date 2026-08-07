"""Append-only activity log repository (FR-6.2, NFR-10).

No update or delete methods exist by design — the model is immutable.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.issue import Activity


def log(
    db: Session,
    issue_id: int,
    actor_id: int,
    action: str,
    field: str | None = None,
    old_value: str | None = None,
    new_value: str | None = None,
) -> Activity:
    entry = Activity(
        issue_id=issue_id,
        actor_id=actor_id,
        action=action,
        field=field,
        old_value=old_value,
        new_value=new_value,
    )
    db.add(entry)
    # Caller commits — log() is always called within the same transaction
    # as the operation it records (issue create, status change, etc.)
    db.flush()
    return entry


def get_for_issue(db: Session, issue_id: int) -> list[Activity]:
    return list(
        db.scalars(
            select(Activity)
            .where(Activity.issue_id == issue_id)
            .order_by(Activity.created_at)
        )
    )
