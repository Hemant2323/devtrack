"""Request/response shapes for project chat."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ChatMessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=10000)

    @field_validator("body")
    @classmethod
    def not_blank(cls, value: str) -> str:
        """A message of nothing but whitespace is empty. min_length alone would
        accept "   ", so trim and re-check."""
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Message cannot be empty")
        return trimmed


class ChatMessageUpdate(BaseModel):
    body: str = Field(min_length=1, max_length=10000)

    @field_validator("body")
    @classmethod
    def not_blank(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Message cannot be empty")
        return trimmed


class ChatMessageResponse(BaseModel):
    id: int
    project_id: int
    author_id: int
    author_name: str   # denormalised from user, as CommentResponse does
    # NULL on a team-chat message; the other participant on a direct message.
    # Both default so existing team-chat clients need no change.
    recipient_id: int | None = None
    recipient_name: str | None = None
    body: str
    created_at: datetime
    edited_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class DmPartnerResponse(BaseModel):
    """One row of the DM sidebar: every other member of the project, carrying
    the last message of the caller's conversation with them when one exists.

    Name and email only — the same identity fields MemberResponse already
    exposes to any member of the project, and nothing further.
    """

    user_id: int
    name: str
    email: str
    last_message_at: datetime | None = None
    last_message_body: str | None = None
