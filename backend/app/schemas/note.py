"""Request/response shapes for project notes (Sprint 6)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.issue import SprintState, Status
from app.models.note import NoteType

# Documentation, so roomier than a chat message (10k) — but still bounded, and
# far short of anything that would make this a document store.
MAX_CONTENT = 50_000


def _not_blank(value: str) -> str:
    """Trim and reject whitespace-only. min_length alone would accept "   "."""
    trimmed = value.strip()
    if not trimmed:
        raise ValueError("This field cannot be empty")
    return trimmed


class NoteCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=MAX_CONTENT)
    note_type: NoteType = NoteType.GENERAL
    # Optional links to the work the note is about.
    issue_id: int | None = None
    sprint_id: int | None = None
    meeting_id: int | None = None

    _clean_title = field_validator("title")(_not_blank)
    _clean_content = field_validator("content")(_not_blank)


class NoteUpdate(BaseModel):
    """Every field optional — the editor saves whatever changed. Sending null
    for issue_id or sprint_id clears that link."""

    title: str | None = Field(None, min_length=1, max_length=200)
    content: str | None = Field(None, min_length=1, max_length=MAX_CONTENT)
    note_type: NoteType | None = None
    issue_id: int | None = None
    sprint_id: int | None = None
    meeting_id: int | None = None

    @field_validator("title", "content")
    @classmethod
    def not_blank(cls, value: str | None) -> str | None:
        return None if value is None else _not_blank(value)


class NoteIssueRef(BaseModel):
    """Just enough of the linked issue to render one line and link to it."""

    id: int
    key: str
    title: str
    status: Status


class NoteSprintRef(BaseModel):
    """Just enough of the linked sprint to render one line and link to it."""

    id: int
    name: str
    state: SprintState


class NoteMeetingRef(BaseModel):
    """Just enough of the linked meeting to render one line and link to it."""

    id: int
    title: str
    scheduled_at: datetime


class NoteResponse(BaseModel):
    id: int
    project_id: int
    author_id: int
    author_name: str   # denormalised, as CommentResponse does
    title: str
    content: str
    note_type: NoteType
    # Resolved rather than copied, and absent when the linked record is gone.
    issue: NoteIssueRef | None = None
    sprint: NoteSprintRef | None = None
    meeting: NoteMeetingRef | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
