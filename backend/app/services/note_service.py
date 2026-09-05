"""Project note business rules (Sprint 6).

Authorization is the existing project convention, unchanged: any member reads
and creates, a non-member gets 404 rather than 403 (existence hiding), and an
archived project rejects every write.

Editing and deleting follow the split comments and chat already use — the
author alone may edit their own words, while the author *or* a project admin
may delete. No new permission concept is introduced.
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.note import Note
from app.models.project import Role
from app.repositories import (
    issue_repo,
    meeting_repo,
    note_repo,
    project_repo,
    sprint_repo,
)
from app.schemas.note import (
    NoteCreate,
    NoteIssueRef,
    NoteMeetingRef,
    NoteResponse,
    NoteSprintRef,
    NoteUpdate,
)


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


def _get_note_or_404(db: Session, note_id: int, caller_id: int) -> tuple[Note, object]:
    note = note_repo.get_by_id(db, note_id)
    if note is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found")
    project = _get_project_or_404(db, note.project_id, caller_id)
    return note, project


def _validate_links(db: Session, project_id: int, changes: dict) -> None:
    """A note may point at one issue, one sprint and one meeting, all of this
    project.

    Only keys actually present are checked, so a PATCH that does not mention a
    link leaves it alone, and an explicit null clears it.
    """
    issue_id = changes.get("issue_id")
    if "issue_id" in changes and issue_id is not None:
        issue = issue_repo.get_by_id(db, issue_id)
        if issue is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Issue not found")
        if issue.project_id != project_id:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "The linked issue must belong to the same project",
            )

    sprint_id = changes.get("sprint_id")
    if "sprint_id" in changes and sprint_id is not None:
        sprint = sprint_repo.get_by_id(db, sprint_id)
        if sprint is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Sprint not found")
        if sprint.project_id != project_id:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "The linked sprint must belong to the same project",
            )

    meeting_id = changes.get("meeting_id")
    if "meeting_id" in changes and meeting_id is not None:
        meeting = meeting_repo.get_by_id(db, meeting_id)
        if meeting is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Meeting not found")
        if meeting.project_id != project_id:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "The linked meeting must belong to the same project",
            )


def _to_response(db: Session, note: Note, project_key: str) -> NoteResponse:
    """Resolve the links at read time rather than copying them into the note.

    A link whose target has since been deleted simply resolves to None — the
    note survives, and the UI stops showing a reference that leads nowhere.
    """
    issue_ref = None
    if note.issue_id is not None:
        issue = issue_repo.get_by_id(db, note.issue_id)
        if issue is not None:
            issue_ref = NoteIssueRef(
                id=issue.id,
                key=f"{project_key}-{issue.number}",
                title=issue.title,
                status=issue.status,
            )

    sprint_ref = None
    if note.sprint_id is not None:
        sprint = sprint_repo.get_by_id(db, note.sprint_id)
        if sprint is not None:
            sprint_ref = NoteSprintRef(id=sprint.id, name=sprint.name, state=sprint.state)

    meeting_ref = None
    if note.meeting_id is not None:
        meeting = meeting_repo.get_by_id(db, note.meeting_id)
        if meeting is not None:
            meeting_ref = NoteMeetingRef(
                id=meeting.id, title=meeting.title, scheduled_at=meeting.scheduled_at
            )

    return NoteResponse(
        id=note.id,
        project_id=note.project_id,
        author_id=note.author_id,
        author_name=note.author.name,
        title=note.title,
        content=note.content,
        note_type=note.note_type,
        issue=issue_ref,
        sprint=sprint_ref,
        meeting=meeting_ref,
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


# ---------- reads ----------


def list_notes(
    db: Session, project_id: int, caller_id: int, note_type=None, meeting_id=None
) -> list[NoteResponse]:
    project = _get_project_or_404(db, project_id, caller_id)
    notes = note_repo.list_for_project(
        db, project_id, note_type=note_type, meeting_id=meeting_id
    )
    return [_to_response(db, note, project.key) for note in notes]


def get_note(db: Session, note_id: int, caller_id: int) -> NoteResponse:
    note, project = _get_note_or_404(db, note_id, caller_id)
    return _to_response(db, note, project.key)


# ---------- writes ----------


def create_note(
    db: Session, project_id: int, data: NoteCreate, caller_id: int
) -> NoteResponse:
    project = _get_project_or_404(db, project_id, caller_id)
    _require_not_archived(project)

    fields = data.model_dump()
    _validate_links(db, project_id, fields)

    note = note_repo.create(db, project_id, caller_id, **fields)
    db.commit()
    db.refresh(note)
    return _to_response(db, note, project.key)


def update_note(
    db: Session, note_id: int, data: NoteUpdate, caller_id: int
) -> NoteResponse:
    """Author only, matching comments and chat: a note carries someone's name,
    so nobody else rewrites it — an admin who disagrees can delete it."""
    note, project = _get_note_or_404(db, note_id, caller_id)
    _require_not_archived(project)

    if note.author_id != caller_id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only the author can edit this note"
        )

    changes = data.model_dump(exclude_unset=True)
    if not changes:
        return _to_response(db, note, project.key)

    _validate_links(db, note.project_id, changes)

    note = note_repo.update(db, note, **changes)
    db.commit()
    db.refresh(note)
    return _to_response(db, note, project.key)


def delete_note(db: Session, note_id: int, caller_id: int) -> None:
    """Hard delete. The author may remove their own note; a project admin may
    remove any — the same moderation split comments and chat use."""
    note, project = _get_note_or_404(db, note_id, caller_id)
    _require_not_archived(project)

    member = project_repo.get_member(db, note.project_id, caller_id)
    is_admin = member is not None and member.role == Role.ADMIN

    if not (note.author_id == caller_id or is_admin):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Only the author or an Admin can delete this note",
        )

    note_repo.delete(db, note)
    db.commit()
