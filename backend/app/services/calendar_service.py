"""Project calendar business rules (Sprint 6).

The calendar is a view over data that already exists. Issues, test cases,
sprints and meetings are read from their own tables per request and normalised
into one shape; none of them is copied into a calendar row. A date changed at
the source is therefore already changed here, with nothing to keep in step.

Editing runs the other way through the source's own service, not through this
one: the calendar's job is to say *whether* a date may be changed by this
caller, and the client then calls the endpoint that already owns that field.
That is why nothing below writes to an issue, a test case, a sprint or a
meeting.

Authorization is the existing project convention throughout: any member reads,
a non-member gets 404 (existence hiding), and an archived project rejects
every write.
"""

import calendar as calendar_lib
from datetime import date, datetime, time, timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.calendar import CalendarEvent
from app.models.project import Role
from app.repositories import calendar_repo, project_repo
from app.schemas.calendar import (
    CalendarEntry,
    CalendarEventCreate,
    CalendarEventResponse,
    CalendarEventType,
    CalendarEventUpdate,
)

# A calendar month plus the days either side that a month grid shows.
MAX_RANGE_DAYS = 120


# ---------- helpers ----------


def _get_project_or_404(db: Session, project_id: int, caller_id: int):
    project = project_repo.get_by_id(db, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    if project_repo.get_member(db, project_id, caller_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return project


def _require_not_archived(project) -> None:
    if project.archived:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Project is archived")


def _get_event_or_404(db: Session, event_id: int, caller_id: int):
    event = calendar_repo.get_by_id(db, event_id)
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    project = _get_project_or_404(db, event.project_id, caller_id)
    return event, project


def _default_month(today: date) -> tuple[date, date]:
    last = calendar_lib.monthrange(today.year, today.month)[1]
    return date(today.year, today.month, 1), date(today.year, today.month, last)


def _at_midnight(value: date) -> datetime:
    """A date rendered as the instant the calendar places it at."""
    return datetime.combine(value, time.min)


# ---------- aggregation ----------


def _issue_entry(issue, project_key: str, writable: bool) -> CalendarEntry:
    return CalendarEntry(
        id=f"issue:{issue.id}",
        type=CalendarEventType.ISSUE,
        source_id=issue.id,
        title=issue.title,
        start=_at_midnight(issue.deadline),
        all_day=True,
        # Any project member may PATCH an issue's deadline, so the only
        # question is whether the project accepts writes at all.
        editable=writable,
        reference=f"{project_key}-{issue.number}",
        status=issue.status.value,
    )


def _test_case_entry(case, writable: bool) -> CalendarEntry:
    return CalendarEntry(
        id=f"test_case:{case.id}",
        type=CalendarEventType.TEST_CASE,
        source_id=case.id,
        title=case.title,
        start=_at_midnight(case.deadline),
        all_day=True,
        # Same rule as issues: any member may update a test case.
        editable=writable,
    )


def _sprint_entry(sprint) -> CalendarEntry:
    """A sprint is a span, shown from its start to its end.

    Read-only on the calendar, deliberately. Sprint dates are admin-only, a
    completed sprint refuses edits outright, and moving one silently from a
    month grid would be a bigger decision than a date picker implies. The
    Sprints page remains the place to change them.
    """
    start = sprint.start_date or sprint.end_date
    end = sprint.end_date if sprint.start_date and sprint.end_date else None
    return CalendarEntry(
        id=f"sprint:{sprint.id}",
        type=CalendarEventType.SPRINT,
        source_id=sprint.id,
        title=sprint.name,
        start=_at_midnight(start),
        end=_at_midnight(end) if end else None,
        all_day=True,
        editable=False,
        status=sprint.state.value,
    )


def _meeting_entry(meeting, caller_id: int, writable: bool) -> CalendarEntry:
    end = (
        meeting.scheduled_at + timedelta(minutes=meeting.duration_minutes)
        if meeting.duration_minutes
        else None
    )
    return CalendarEntry(
        id=f"meeting:{meeting.id}",
        type=CalendarEventType.MEETING,
        source_id=meeting.id,
        title=meeting.title,
        start=meeting.scheduled_at,
        end=end,
        all_day=False,
        # Meetings are organizer-only to edit, so the answer differs per caller.
        editable=writable and meeting.organizer_id == caller_id,
    )


def _custom_entry(event: CalendarEvent, caller_id: int, writable: bool) -> CalendarEntry:
    return CalendarEntry(
        id=f"custom:{event.id}",
        type=CalendarEventType.CUSTOM,
        source_id=event.id,
        title=event.title,
        start=event.starts_at,
        end=event.ends_at,
        all_day=False,
        editable=writable and event.creator_id == caller_id,
    )


def get_calendar(
    db: Session,
    project_id: int,
    caller_id: int,
    start: date | None = None,
    end: date | None = None,
    types: list[CalendarEventType] | None = None,
    today: date | None = None,
) -> list[CalendarEntry]:
    """Everything dated in the window, from every source, in one response.

    Omitting the range gives the current month. Omitting `types` gives all of
    them; naming some skips the others' queries entirely, so a filtered view
    costs less rather than the same.
    """
    project = _get_project_or_404(db, project_id, caller_id)

    if (start is None) != (end is None):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Provide both start and end, or neither",
        )
    if start is None:
        start, end = _default_month(today or date.today())
    if end < start:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "end must not be earlier than start"
        )
    if (end - start).days > MAX_RANGE_DAYS:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Range must not exceed {MAX_RANGE_DAYS} days",
        )

    wanted = set(types) if types else set(CalendarEventType)
    # The window as instants, for the sources stored as datetimes.
    from_instant = _at_midnight(start)
    to_instant = datetime.combine(end, time.max)
    writable = not project.archived

    entries: list[CalendarEntry] = []

    if CalendarEventType.ISSUE in wanted:
        entries += [
            _issue_entry(issue, project.key, writable)
            for issue in calendar_repo.issues_due_in_range(db, project_id, start, end)
        ]

    if CalendarEventType.TEST_CASE in wanted:
        entries += [
            _test_case_entry(case, writable)
            for case in calendar_repo.test_cases_due_in_range(db, project_id, start, end)
        ]

    if CalendarEventType.SPRINT in wanted:
        entries += [
            _sprint_entry(sprint)
            for sprint in calendar_repo.sprints_in_range(db, project_id, start, end)
        ]

    if CalendarEventType.MEETING in wanted:
        entries += [
            _meeting_entry(meeting, caller_id, writable)
            for meeting in calendar_repo.meetings_in_range(
                db, project_id, from_instant, to_instant
            )
        ]

    if CalendarEventType.CUSTOM in wanted:
        entries += [
            _custom_entry(event, caller_id, writable)
            for event in calendar_repo.list_events_in_range(
                db, project_id, from_instant, to_instant
            )
        ]

    entries.sort(key=lambda entry: (entry.start, entry.type.value, entry.source_id))
    return entries


# ---------- custom event CRUD ----------


def _to_response(event: CalendarEvent) -> CalendarEventResponse:
    return CalendarEventResponse(
        id=event.id,
        project_id=event.project_id,
        creator_id=event.creator_id,
        creator_name=event.creator.name,
        title=event.title,
        description=event.description,
        starts_at=event.starts_at,
        ends_at=event.ends_at,
        created_at=event.created_at,
        updated_at=event.updated_at,
    )


def list_events(
    db: Session,
    project_id: int,
    caller_id: int,
    start: date | None = None,
    end: date | None = None,
    today: date | None = None,
) -> list[CalendarEventResponse]:
    """The project's own calendar events in full, for the range given (or the
    current month). The aggregated calendar returns the same rows normalised;
    this is the shape the event dialog reads and writes."""
    _get_project_or_404(db, project_id, caller_id)
    if (start is None) != (end is None):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Provide both start and end, or neither",
        )
    if start is None:
        start, end = _default_month(today or date.today())
    if end < start:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "end must not be earlier than start"
        )

    events = calendar_repo.list_events_in_range(
        db, project_id, _at_midnight(start), datetime.combine(end, time.max)
    )
    return [_to_response(event) for event in events]


def get_event(db: Session, event_id: int, caller_id: int) -> CalendarEventResponse:
    event, _ = _get_event_or_404(db, event_id, caller_id)
    return _to_response(event)


def create_event(
    db: Session, project_id: int, data: CalendarEventCreate, caller_id: int
) -> CalendarEventResponse:
    project = _get_project_or_404(db, project_id, caller_id)
    _require_not_archived(project)

    event = calendar_repo.create_event(db, project_id, caller_id, **data.model_dump())
    db.commit()
    db.refresh(event)
    return _to_response(event)


def update_event(
    db: Session, event_id: int, data: CalendarEventUpdate, caller_id: int
) -> CalendarEventResponse:
    """Creator only, matching the author-only edit rule used by notes, chat and
    meetings."""
    event, project = _get_event_or_404(db, event_id, caller_id)
    _require_not_archived(project)

    if event.creator_id != caller_id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only the creator can edit this event"
        )

    changes = data.model_dump(exclude_unset=True)
    if not changes:
        return _to_response(event)

    # Validate the resulting pair, not just the supplied one: moving only the
    # start must still not produce an event that ends before it begins.
    new_start = changes.get("starts_at", event.starts_at)
    new_end = changes.get("ends_at", event.ends_at)
    if new_end is not None and new_end < new_start:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "ends_at must not be earlier than starts_at",
        )

    event = calendar_repo.update_event(db, event, **changes)
    db.commit()
    db.refresh(event)
    return _to_response(event)


def delete_event(db: Session, event_id: int, caller_id: int) -> None:
    """Hard delete. The creator may remove their own event; a project admin may
    remove any — the same split notes, chat and meetings use."""
    event, project = _get_event_or_404(db, event_id, caller_id)
    _require_not_archived(project)

    member = project_repo.get_member(db, event.project_id, caller_id)
    is_admin = member is not None and member.role == Role.ADMIN

    if not (event.creator_id == caller_id or is_admin):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Only the creator or an Admin can delete this event",
        )

    calendar_repo.delete_event(db, event)
    db.commit()
