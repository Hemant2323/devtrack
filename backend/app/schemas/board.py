"""Response shapes for comments, notifications, and the board view."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.notification import NotifType


# ---------- comments ----------


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=10000)


class CommentUpdate(BaseModel):
    body: str = Field(min_length=1, max_length=10000)


class CommentResponse(BaseModel):
    id: int
    issue_id: int
    author_id: int
    author_name: str   # denormalised from user
    body: str
    created_at: datetime
    edited_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


# ---------- notifications ----------


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    type: NotifType
    message: str
    issue_id: int | None
    read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MarkReadRequest(BaseModel):
    ids: list[int]


class NotificationSummary(BaseModel):
    unread_count: int
    notifications: list[NotificationResponse]


# Board response is a plain dict returned directly by the router;
# no Pydantic class needed since the column values are typed IssueResponse lists.
