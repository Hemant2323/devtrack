"""Project meeting endpoints (Sprint 6). Routers stay thin.

Shape follows the project conventions already in place: the collection hangs
off its project (like `/projects/{id}/notes`) and one meeting is addressed by
its own id (like `/notes/{id}`).

No Google API is called anywhere below. `meet_url` is a link a person pasted;
it is validated for shape and handed back for the browser to open.
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.meeting import MeetingCreate, MeetingResponse, MeetingUpdate
from app.services import meeting_service

router = APIRouter(tags=["meetings"])


@router.get("/projects/{project_id}/meetings", response_model=list[MeetingResponse])
def list_meetings(
    project_id: int,
    scope: str | None = Query(None, description="upcoming | past"),
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """`scope=upcoming` counts forward from the next meeting, `scope=past`
    counts back from the most recent. Omitted, the whole list comes back
    newest-scheduled first."""
    return meeting_service.list_meetings(db, project_id, me.id, scope)


@router.post(
    "/projects/{project_id}/meetings",
    response_model=MeetingResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_meeting(
    project_id: int,
    data: MeetingCreate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    return meeting_service.create_meeting(db, project_id, data, me.id)


@router.get("/meetings/{meeting_id}", response_model=MeetingResponse)
def get_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    return meeting_service.get_meeting(db, meeting_id, me.id)


@router.patch("/meetings/{meeting_id}", response_model=MeetingResponse)
def update_meeting(
    meeting_id: int,
    data: MeetingUpdate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Organizer only; anyone else receives 403."""
    return meeting_service.update_meeting(db, meeting_id, data, me.id)


@router.delete("/meetings/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Organizer or project admin; anyone else receives 403."""
    meeting_service.delete_meeting(db, meeting_id, me.id)
