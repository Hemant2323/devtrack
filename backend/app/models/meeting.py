"""Project meetings model (Sprint 6).

A meeting is a scheduled conversation with an agenda, some project members,
and — when the organiser has made one elsewhere — a pasted video-call link.
Deliberately not a calendar system: no recurrence, no invitations, no RSVP,
no reminders, and no call is created, joined or recorded by this application.
The link is a string someone pasted.

`meet_url` is stored as plain text rather than a URL type because nothing here
ever fetches it; it is validated for shape at the schema boundary and then
handed straight back to the browser.

Participants live in their own table rather than as a column of ids, so a
participant is a real row referencing a real user — the same shape
ProjectMember uses — and no user data is copied into the meeting.
"""

from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, utcnow


class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    organizer_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")

    # Indexed because every read of this table either orders by it or splits
    # upcoming from past on it. Stored as naive UTC — the schema converts any
    # offset it is given, because SQLite silently drops tzinfo on write.
    scheduled_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Pasted by hand. No Google API is ever called.
    meet_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Optional context. One sprint, the same shape Note uses — not a
    # relationship system built for meetings alone.
    sprint_id: Mapped[int | None] = mapped_column(
        ForeignKey("sprints.id"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=utcnow,
        onupdate=utcnow,
    )

    organizer = relationship("User")
    participants: Mapped[list["MeetingParticipant"]] = relationship(
        back_populates="meeting", cascade="all, delete-orphan"
    )


class MeetingParticipant(Base):
    """One project member attending one meeting.

    No status column: there is no invitation and no RSVP to record. A row
    means "listed as attending", which is all this feature claims.
    """

    __tablename__ = "meeting_participants"
    # A person is listed on a meeting once.
    __table_args__ = (UniqueConstraint("meeting_id", "user_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

    meeting: Mapped[Meeting] = relationship(back_populates="participants")
    user = relationship("User")
