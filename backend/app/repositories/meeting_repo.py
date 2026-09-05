"""All database queries for project meetings."""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.meeting import Meeting, MeetingParticipant


def _loaded(stmt):
    """Organiser and participants (with their users) in one round trip.

    Without this, rendering a list of meetings would issue a query per meeting
    for its participants and another per participant for the user — the N+1
    this endpoint would otherwise be most prone to.
    """
    return stmt.options(
        selectinload(Meeting.organizer),
        selectinload(Meeting.participants).selectinload(MeetingParticipant.user),
    )


def get_by_id(db: Session, meeting_id: int) -> Meeting | None:
    return db.scalar(_loaded(select(Meeting).where(Meeting.id == meeting_id)))


def list_for_project(
    db: Session,
    project_id: int,
    *,
    scope: str | None = None,
    now: datetime | None = None,
) -> list[Meeting]:
    """Meetings of one project.

    `scope` splits the timeline and picks the ordering each half wants:
    "upcoming" counts forward from the next one, "past" counts back from the
    most recent. Without it the whole list comes back newest-scheduled first.
    The boundary is passed in rather than read here so the service owns the
    definition of "now".
    """
    stmt = _loaded(select(Meeting).where(Meeting.project_id == project_id))

    if scope == "upcoming":
        stmt = stmt.where(Meeting.scheduled_at >= now).order_by(
            Meeting.scheduled_at.asc(), Meeting.id.asc()
        )
    elif scope == "past":
        stmt = stmt.where(Meeting.scheduled_at < now).order_by(
            Meeting.scheduled_at.desc(), Meeting.id.desc()
        )
    else:
        stmt = stmt.order_by(Meeting.scheduled_at.desc(), Meeting.id.desc())

    return list(db.scalars(stmt).unique())


def create(db: Session, project_id: int, organizer_id: int, **fields) -> Meeting:
    meeting = Meeting(project_id=project_id, organizer_id=organizer_id, **fields)
    db.add(meeting)
    db.flush()
    return meeting


def update(db: Session, meeting: Meeting, **fields) -> Meeting:
    for key, value in fields.items():
        setattr(meeting, key, value)
    db.flush()
    return meeting


def set_participants(db: Session, meeting: Meeting, user_ids: list[int]) -> None:
    """Replace the attendee list.

    Rows that survive are left alone rather than deleted and recreated, so ids
    stay stable and the unique constraint is never momentarily violated.
    """
    wanted = set(user_ids)
    current = {participant.user_id: participant for participant in meeting.participants}

    for user_id, participant in current.items():
        if user_id not in wanted:
            meeting.participants.remove(participant)
            db.delete(participant)

    for user_id in user_ids:
        if user_id not in current:
            meeting.participants.append(MeetingParticipant(user_id=user_id))

    db.flush()


def delete(db: Session, meeting: Meeting) -> None:
    """Hard delete. Participant rows go with it via cascade."""
    db.delete(meeting)
    db.flush()
