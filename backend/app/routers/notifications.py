"""Notifications endpoints (FR-8)."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.repositories import notification_repo
from app.schemas.board import MarkReadRequest, NotificationResponse, NotificationSummary

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationSummary)
def list_notifications(
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    notifs = notification_repo.list_for_user(db, me.id)
    unread = sum(1 for n in notifs if not n.read)
    return NotificationSummary(
        unread_count=unread,
        notifications=[NotificationResponse.model_validate(n) for n in notifs],
    )


@router.post("/read")
def mark_read(
    data: MarkReadRequest,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    updated = notification_repo.mark_read(db, me.id, data.ids)
    db.commit()
    return {"marked_read": updated}
