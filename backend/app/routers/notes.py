"""Project note endpoints (Sprint 6). Routers stay thin.

Shape follows the project conventions already in place: the collection hangs
off its project (like `/projects/{id}/issues`) and a single note is addressed
by its own id (like `/issues/{id}`), so nothing new has to be learned.
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.note import NoteType
from app.models.user import User
from app.schemas.note import NoteCreate, NoteResponse, NoteUpdate
from app.services import note_service

router = APIRouter(tags=["notes"])


@router.get("/projects/{project_id}/notes", response_model=list[NoteResponse])
def list_notes(
    project_id: int,
    note_type: NoteType | None = Query(None),
    meeting_id: int | None = Query(None),
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Most recently edited first. `note_type` and `meeting_id` narrow the
    list, matching the query-parameter filtering the issues endpoint uses;
    `meeting_id` is how a meeting shows the notes written for it, in one
    request rather than one per note."""
    return note_service.list_notes(db, project_id, me.id, note_type, meeting_id)


@router.post(
    "/projects/{project_id}/notes",
    response_model=NoteResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_note(
    project_id: int,
    data: NoteCreate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    return note_service.create_note(db, project_id, data, me.id)


@router.get("/notes/{note_id}", response_model=NoteResponse)
def get_note(
    note_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    return note_service.get_note(db, note_id, me.id)


@router.patch("/notes/{note_id}", response_model=NoteResponse)
def update_note(
    note_id: int,
    data: NoteUpdate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Author only; anyone else receives 403."""
    return note_service.update_note(db, note_id, data, me.id)


@router.delete("/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(
    note_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Author or project admin; anyone else receives 403."""
    note_service.delete_note(db, note_id, me.id)
