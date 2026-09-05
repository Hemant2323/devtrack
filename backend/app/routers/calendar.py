"""Project calendar endpoints (Sprint 6). Routers stay thin.

The aggregated calendar is a read: `GET /projects/{id}/calendar` normalises
issues, test cases, sprints, meetings and custom events into one list. It has
no write counterpart on purpose — changing an issue's deadline is a PATCH to
that issue, and the response tells the client which entries it may do that to.

Custom events are the calendar's own records, and follow the project
conventions already in place: the collection hangs off its project, one event
is addressed by its own id.
"""

from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.calendar import (
    CalendarEntry,
    CalendarEventCreate,
    CalendarEventResponse,
    CalendarEventType,
    CalendarEventUpdate,
)
from app.services import calendar_service

router = APIRouter(tags=["calendar"])


@router.get("/projects/{project_id}/calendar", response_model=list[CalendarEntry])
def get_calendar(
    project_id: int,
    start: date | None = Query(None, description="First day of the window"),
    end: date | None = Query(None, description="Last day of the window, inclusive"),
    types: list[CalendarEventType] | None = Query(None),
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Everything dated in the window, from every source.

    Omit `start`/`end` for the current month. `types` narrows which sources are
    queried at all. Nothing here is stored as a calendar row — the entries are
    read from the issues, test cases, sprints and meetings themselves.
    """
    return calendar_service.get_calendar(db, project_id, me.id, start, end, types)


# ---------- custom events ----------


@router.get(
    "/projects/{project_id}/calendar/events",
    response_model=list[CalendarEventResponse],
)
def list_events(
    project_id: int,
    start: date | None = Query(None),
    end: date | None = Query(None),
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """The project's own calendar events, in full. The aggregated calendar
    returns these too, in its normalised shape."""
    return calendar_service.list_events(db, project_id, me.id, start, end)


@router.post(
    "/projects/{project_id}/calendar/events",
    response_model=CalendarEventResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_event(
    project_id: int,
    data: CalendarEventCreate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    return calendar_service.create_event(db, project_id, data, me.id)


@router.get("/calendar/events/{event_id}", response_model=CalendarEventResponse)
def get_event(
    event_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    return calendar_service.get_event(db, event_id, me.id)


@router.patch("/calendar/events/{event_id}", response_model=CalendarEventResponse)
def update_event(
    event_id: int,
    data: CalendarEventUpdate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Creator only; anyone else receives 403."""
    return calendar_service.update_event(db, event_id, data, me.id)


@router.delete("/calendar/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Creator or project admin; anyone else receives 403."""
    calendar_service.delete_event(db, event_id, me.id)
