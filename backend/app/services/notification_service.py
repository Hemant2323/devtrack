"""Thin helper called by issue_service and comment_service to fire notifications.

Kept separate so the logic for "who gets notified and why" lives in
one place and is easy to extend (e.g. email delivery later).
"""

from sqlalchemy.orm import Session

from app.models.notification import NotifType
from app.repositories import notification_repo


def notify(
    db: Session,
    user_id: int,
    type_: NotifType,
    message: str,
    issue_id: int | None = None,
) -> None:
    """Create one notification. No-op if user_id is None (unassigned issue)."""
    if user_id is None:
        return
    notification_repo.create(db, user_id, type_, message, issue_id)
