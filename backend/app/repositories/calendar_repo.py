"""Calendar queries.

Two jobs. The first is ordinary CRUD over `calendar_events`, the only table
the calendar owns. The second is the range scan over the *other* tables —
issues, test cases, sprints, meetings — which the calendar reads but never
writes and never copies.

Each source is one query, scoped to the project and the requested window, so a
month costs five queries regardless of how much the project contains. Nothing
here loads a source record it will not display.
"""

from datetime import date, datetime

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.calendar import CalendarEvent
from app.models.issue import Issue, Sprint
from app.models.meeting import Meeting
from app.models.testing import TestCase


# ---------- custom events (the only rows the calendar owns) ----------


def get_by_id(db: Session, event_id: int) -> CalendarEvent | None:
    return db.scalar(
        select(CalendarEvent)
        .where(CalendarEvent.id == event_id)
        .options(selectinload(CalendarEvent.creator))
    )


def list_events_in_range(
    db: Session, project_id: int, start: datetime, end: datetime
) -> list[CalendarEvent]:
    """Custom events overlapping the window.

    An event counts as overlapping when it begins before the window closes and
    finishes after it opens — so a long event spanning the whole month is
    included even though neither endpoint falls inside it. An event with no
    end is a point, tested on its start alone.
    """
    overlaps = and_(
        CalendarEvent.starts_at <= end,
        or_(
            and_(CalendarEvent.ends_at.is_(None), CalendarEvent.starts_at >= start),
            and_(CalendarEvent.ends_at.is_not(None), CalendarEvent.ends_at >= start),
        ),
    )
    return list(
        db.scalars(
            select(CalendarEvent)
            .where(CalendarEvent.project_id == project_id, overlaps)
            .options(selectinload(CalendarEvent.creator))
            .order_by(CalendarEvent.starts_at.asc(), CalendarEvent.id.asc())
        )
    )


def create_event(db: Session, project_id: int, creator_id: int, **fields) -> CalendarEvent:
    event = CalendarEvent(project_id=project_id, creator_id=creator_id, **fields)
    db.add(event)
    db.flush()
    return event


def update_event(db: Session, event: CalendarEvent, **fields) -> CalendarEvent:
    for key, value in fields.items():
        setattr(event, key, value)
    db.flush()
    return event


def delete_event(db: Session, event: CalendarEvent) -> None:
    db.delete(event)
    db.flush()


# ---------- read-only scans of the source tables ----------


def issues_due_in_range(
    db: Session, project_id: int, start: date, end: date
) -> list[Issue]:
    """Live issues whose deadline falls in the window."""
    return list(
        db.scalars(
            select(Issue)
            .where(
                Issue.project_id == project_id,
                Issue.deleted_at.is_(None),
                Issue.deadline.is_not(None),
                Issue.deadline >= start,
                Issue.deadline <= end,
            )
            .order_by(Issue.deadline.asc(), Issue.id.asc())
        )
    )


def test_cases_due_in_range(
    db: Session, project_id: int, start: date, end: date
) -> list[TestCase]:
    return list(
        db.scalars(
            select(TestCase)
            .where(
                TestCase.project_id == project_id,
                TestCase.deadline.is_not(None),
                TestCase.deadline >= start,
                TestCase.deadline <= end,
            )
            .order_by(TestCase.deadline.asc(), TestCase.id.asc())
        )
    )


def sprints_in_range(
    db: Session, project_id: int, start: date, end: date
) -> list[Sprint]:
    """Sprints touching the window.

    A sprint is a span, so one running from before the window to after it must
    still appear. Either endpoint alone may be missing, in which case the
    sprint is treated as the point it does have; a sprint with no dates at all
    cannot be placed and is excluded.
    """
    spans = and_(
        Sprint.start_date.is_not(None),
        Sprint.end_date.is_not(None),
        Sprint.start_date <= end,
        Sprint.end_date >= start,
    )
    start_only = and_(
        Sprint.start_date.is_not(None),
        Sprint.end_date.is_(None),
        Sprint.start_date >= start,
        Sprint.start_date <= end,
    )
    end_only = and_(
        Sprint.start_date.is_(None),
        Sprint.end_date.is_not(None),
        Sprint.end_date >= start,
        Sprint.end_date <= end,
    )
    return list(
        db.scalars(
            select(Sprint)
            .where(Sprint.project_id == project_id, or_(spans, start_only, end_only))
            .order_by(Sprint.start_date.asc(), Sprint.id.asc())
        )
    )


def meetings_in_range(
    db: Session, project_id: int, start: datetime, end: datetime
) -> list[Meeting]:
    """Meetings scheduled inside the window. Duration is applied by the
    service when it computes the end, so nothing extra is loaded here."""
    return list(
        db.scalars(
            select(Meeting)
            .where(
                Meeting.project_id == project_id,
                Meeting.scheduled_at >= start,
                Meeting.scheduled_at <= end,
            )
            .order_by(Meeting.scheduled_at.asc(), Meeting.id.asc())
        )
    )
