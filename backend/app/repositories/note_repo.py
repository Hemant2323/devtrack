"""All database queries for project notes."""

# Aliased: this module defines its own `update` for a single note.
from sqlalchemy import select, update as sa_update
from sqlalchemy.orm import Session, selectinload

from app.models.note import Note, NoteType


def get_by_id(db: Session, note_id: int) -> Note | None:
    return db.get(Note, note_id)


def list_for_project(
    db: Session,
    project_id: int,
    *,
    note_type: NoteType | None = None,
    meeting_id: int | None = None,
) -> list[Note]:
    """Most recently edited first.

    Deliberately updated_at rather than the created_at ordering issues and
    sprints use: a note is a living document, so the one worked on last is the
    one wanted first. `id` breaks ties so the order is stable when several
    notes share a timestamp.
    """
    stmt = (
        select(Note)
        .where(Note.project_id == project_id)
        .options(selectinload(Note.author))
        .order_by(Note.updated_at.desc(), Note.id.desc())
    )
    if note_type is not None:
        stmt = stmt.where(Note.note_type == note_type)
    if meeting_id is not None:
        stmt = stmt.where(Note.meeting_id == meeting_id)
    return list(db.scalars(stmt))


def clear_meeting_links(db: Session, meeting_id: int) -> None:
    """Detach notes from a meeting that is being deleted.

    The link is nullable and resolved at read time, so a dangling id would
    still render harmlessly — but leaving one would break on any database that
    actually enforces foreign keys, which SQLite does not by default.
    """
    db.execute(
        sa_update(Note).where(Note.meeting_id == meeting_id).values(meeting_id=None)
    )
    db.flush()


def create(db: Session, project_id: int, author_id: int, **fields) -> Note:
    note = Note(project_id=project_id, author_id=author_id, **fields)
    db.add(note)
    db.flush()
    return note


def update(db: Session, note: Note, **fields) -> Note:
    for key, value in fields.items():
        setattr(note, key, value)
    db.flush()
    return note


def delete(db: Session, note: Note) -> None:
    """Hard delete, consistent with comments and chat. Issues are the only
    soft-deleted resource in the codebase."""
    db.delete(note)
    db.flush()
