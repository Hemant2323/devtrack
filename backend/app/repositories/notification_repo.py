"""Notification queries."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.notification import Notification, NotifType


def create(
    db: Session,
    user_id: int,
    type_: NotifType,
    message: str,
    issue_id: int | None = None,
) -> Notification:
    n = Notification(user_id=user_id, type=type_, message=message, issue_id=issue_id)
    db.add(n)
    db.flush()
    return n


def list_for_user(db: Session, user_id: int) -> list[Notification]:
    return list(
        db.scalars(
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
        )
    )


def mark_read(db: Session, user_id: int, ids: list[int]) -> int:
    """Mark the given notification ids as read (only if they belong to user_id).
    Returns count updated."""
    notifs = list(
        db.scalars(
            select(Notification).where(
                Notification.user_id == user_id,
                Notification.id.in_(ids),
                Notification.read.is_(False),
            )
        )
    )
    for n in notifs:
        n.read = True
    db.flush()
    return len(notifs)


def unread_count(db: Session, user_id: int) -> int:
    notifs = db.scalars(
        select(Notification).where(
            Notification.user_id == user_id, Notification.read.is_(False)
        )
    )
    return len(list(notifs))
