"""Request/response shapes for the project calendar (Sprint 6)."""

import enum
from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

MAX_DESCRIPTION = 5_000


class CalendarEventType(str, enum.Enum):
    """Where a calendar entry came from. Also the filter vocabulary."""

    ISSUE = "ISSUE"
    TEST_CASE = "TEST_CASE"
    SPRINT = "SPRINT"
    MEETING = "MEETING"
    CUSTOM = "CUSTOM"


def _to_naive_utc(value: datetime) -> datetime:
    """Normalise to naive UTC before it reaches the database — the same rule
    Meeting.scheduled_at uses, and for the same reason: SQLite drops tzinfo on
    write without converting, so an offset would be silently lost."""
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _not_blank(value: str) -> str:
    trimmed = value.strip()
    if not trimmed:
        raise ValueError("This field cannot be empty")
    return trimmed


# ---------- custom events ----------


class CalendarEventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=MAX_DESCRIPTION)
    starts_at: datetime
    ends_at: datetime | None = None

    _clean_title = field_validator("title")(_not_blank)

    @field_validator("starts_at", "ends_at")
    @classmethod
    def normalise(cls, value: datetime | None) -> datetime | None:
        return None if value is None else _to_naive_utc(value)

    @model_validator(mode="after")
    def validate_order(self):
        """An event that ends before it starts is always a mistake — the same
        rule, and the same wording, SprintCreate applies to its dates."""
        if self.ends_at is not None and self.ends_at < self.starts_at:
            raise ValueError("ends_at must not be earlier than starts_at")
        return self


class CalendarEventUpdate(BaseModel):
    """Every field optional. Sending null for ends_at clears it."""

    title: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = Field(None, max_length=MAX_DESCRIPTION)
    starts_at: datetime | None = None
    ends_at: datetime | None = None

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, value: str | None) -> str | None:
        return None if value is None else _not_blank(value)

    @field_validator("starts_at", "ends_at")
    @classmethod
    def normalise(cls, value: datetime | None) -> datetime | None:
        return None if value is None else _to_naive_utc(value)

    @model_validator(mode="after")
    def validate_order(self):
        """Only checkable when both are supplied in the same patch; a partial
        move is validated against the stored value in the service."""
        if self.starts_at and self.ends_at and self.ends_at < self.starts_at:
            raise ValueError("ends_at must not be earlier than starts_at")
        return self


class CalendarEventResponse(BaseModel):
    """The stored custom event, for its own create/read/update endpoints."""

    id: int
    project_id: int
    creator_id: int
    creator_name: str   # denormalised, as CommentResponse does
    title: str
    description: str
    starts_at: datetime
    ends_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------- the aggregated calendar ----------


class CalendarEntry(BaseModel):
    """One thing on the calendar, whatever it came from.

    Nothing here is stored. Issues, test cases, sprints and meetings are read
    from their own tables and normalised into this shape per request, so the
    calendar can never hold a stale copy of a date.

    `id` is unique across sources ("issue:12"), which is what the client keys
    rows on; `type` plus `source_id` is what it navigates and edits by. Only
    the two extra fields the chip actually renders are included — no source
    record is passed through wholesale.
    """

    id: str
    type: CalendarEventType
    source_id: int
    title: str
    start: datetime
    end: datetime | None = None
    # Dates (an issue deadline, a sprint) versus instants (a meeting).
    all_day: bool
    # Whether *this caller* may change this date from the calendar, given the
    # source's own rules and the project's archived state.
    editable: bool
    # "DEV-42" for an issue; None otherwise.
    reference: str | None = None
    # Issue status or sprint state, for the chip's tone. None otherwise.
    status: str | None = None
