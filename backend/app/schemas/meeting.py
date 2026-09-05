"""Request/response shapes for project meetings (Sprint 6)."""

from datetime import datetime, timezone
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.issue import SprintState

MAX_DESCRIPTION = 20_000
# Long enough for any real conference link, short enough to be a URL.
MAX_URL = 500
# A day is already generous for a meeting; the cap only exists to reject typos.
MAX_DURATION_MINUTES = 24 * 60


def _to_naive_utc(value: datetime) -> datetime:
    """Normalise to naive UTC before it reaches the database.

    SQLite drops tzinfo on write without converting, so "14:00+05:30" would be
    stored as 14:00 UTC — off by the offset. Converting here means a client may
    send whatever offset it likes and the stored instant is still correct.
    """
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _clean_url(value: str | None) -> str | None:
    """Accept any ordinary http(s) URL — the link is pasted by hand and could
    be Meet, Zoom or anything else. Nothing in the backend ever fetches it, so
    this checks shape, not reachability."""
    if value is None:
        return None
    trimmed = value.strip()
    if not trimmed:
        return None  # an emptied field clears the link
    parsed = urlparse(trimmed)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("Enter a full link starting with http:// or https://")
    return trimmed


def _not_blank(value: str) -> str:
    trimmed = value.strip()
    if not trimmed:
        raise ValueError("This field cannot be empty")
    return trimmed


class MeetingCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=MAX_DESCRIPTION)
    scheduled_at: datetime
    duration_minutes: int | None = Field(None, ge=1, le=MAX_DURATION_MINUTES)
    meet_url: str | None = Field(None, max_length=MAX_URL)
    sprint_id: int | None = None
    # User ids; validated against project membership in the service.
    participant_ids: list[int] = Field(default_factory=list)

    _clean_title = field_validator("title")(_not_blank)
    _normalise_when = field_validator("scheduled_at")(_to_naive_utc)
    _check_url = field_validator("meet_url")(_clean_url)


class MeetingUpdate(BaseModel):
    """Every field optional. Sending null for sprint_id or meet_url clears it;
    sending participant_ids replaces the whole list."""

    title: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = Field(None, max_length=MAX_DESCRIPTION)
    scheduled_at: datetime | None = None
    duration_minutes: int | None = Field(None, ge=1, le=MAX_DURATION_MINUTES)
    meet_url: str | None = Field(None, max_length=MAX_URL)
    sprint_id: int | None = None
    participant_ids: list[int] | None = None

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, value: str | None) -> str | None:
        return None if value is None else _not_blank(value)

    @field_validator("scheduled_at")
    @classmethod
    def normalise_when(cls, value: datetime | None) -> datetime | None:
        return None if value is None else _to_naive_utc(value)

    _check_url = field_validator("meet_url")(_clean_url)


class MeetingParticipantRef(BaseModel):
    """A participant as the UI shows one: a name and an avatar, nothing more.
    Email is included because two members can share a display name — the same
    two identity fields MemberResponse already exposes to project members."""

    user_id: int
    name: str
    email: str


class MeetingSprintRef(BaseModel):
    id: int
    name: str
    state: SprintState


class MeetingResponse(BaseModel):
    id: int
    project_id: int
    organizer_id: int
    organizer_name: str   # denormalised, as CommentResponse does
    title: str
    description: str
    scheduled_at: datetime
    duration_minutes: int | None
    meet_url: str | None
    sprint: MeetingSprintRef | None = None
    participants: list[MeetingParticipantRef] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
