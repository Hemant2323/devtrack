"""Project notes model (Sprint 6).

Lightweight team documentation: meeting notes, sprint planning and reviews,
retrospectives, technical decisions. Deliberately one flat row of plain text
per note — no blocks, no nesting, no page tree. The feature is meant to be
proportional to DevTrack, not to a document editor.

`note_type` is a small closed set used for filtering and labelling. It is not a
template engine: templates live in the frontend and only prefill text, so a
note's type can be changed afterwards without anything else following it.

The optional issue, sprint and meeting links are plain nullable FKs rather
than a join table. A note points at one piece of work, not many, and the linked records are
referenced — never copied — so a renamed issue reads correctly here without a
second write.
"""

import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class NoteType(str, enum.Enum):
    GENERAL = "GENERAL"
    MEETING = "MEETING"
    SPRINT = "SPRINT"
    TECHNICAL = "TECHNICAL"
    RETROSPECTIVE = "RETROSPECTIVE"


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    # Same ceiling as Issue.title, so the two read alike in a list.
    title: Mapped[str] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(Text)
    note_type: Mapped[NoteType] = mapped_column(
        Enum(NoteType), default=NoteType.GENERAL, index=True
    )

    # Optional links to the work the note is about. Both nullable: most notes
    # reference nothing, and a note must survive the thing it points at being
    # deleted — the API simply stops returning a link it can no longer resolve.
    issue_id: Mapped[int | None] = mapped_column(
        ForeignKey("issues.id"), nullable=True
    )
    sprint_id: Mapped[int | None] = mapped_column(
        ForeignKey("sprints.id"), nullable=True
    )
    # Sprint 6.4: a note written for a meeting. A third link of exactly the
    # same shape, indexed because the meeting page fetches a meeting's notes
    # by it — no separate meeting-notes system, and no change to how notes
    # otherwise work.
    meeting_id: Mapped[int | None] = mapped_column(
        ForeignKey("meetings.id"), nullable=True, index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    author = relationship("User")
