"""Custom calendar event model (Sprint 6).

The calendar itself stores nothing about issues, test cases, sprints or
meetings — those are read from their own tables at request time, so a date
changed at the source is already changed on the calendar. This table exists
only for dates that belong to no other DevTrack object: a release day, a
holiday, a deadline that is not an issue.

Deliberately not a task system: a title, some text, a start, an optional end.
No status, no assignee, no recurrence, no reminders.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, utcnow


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    creator_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")

    # Indexed because every read of this table filters on a date range.
    # Stored as naive UTC, like Meeting.scheduled_at — the schema converts any
    # offset it is given, because SQLite drops tzinfo on write.
    starts_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=utcnow,
        onupdate=utcnow,
    )

    creator = relationship("User")
