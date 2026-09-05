"""Project meeting business rules (Sprint 6).

Authorization is the existing project convention, unchanged: any member reads
and creates, a non-member gets 404 rather than 403 (existence hiding), and an
archived project rejects every write. Editing and deleting follow the split
notes, comments and chat already use — the organiser alone may edit, while the
organiser *or* a project admin may delete.

Nothing here talks to Google, or to any calendar. `meet_url` is a string a
person pasted; the application stores it and hands it back.
"""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.meeting import Meeting
from app.models.project import Role
from app.repositories import meeting_repo, note_repo, project_repo, sprint_repo
from app.schemas.meeting import (
    MeetingCreate,
    MeetingParticipantRef,
    MeetingResponse,
    MeetingSprintRef,
    MeetingUpdate,
)

SCOPES = ("upcoming", "past")


def _now() -> datetime:
    """Naive UTC, matching how scheduled_at is stored."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


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


def _get_meeting_or_404(db: Session, meeting_id: int, caller_id: int):
    meeting = meeting_repo.get_by_id(db, meeting_id)
    if meeting is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meeting not found")
    project = _get_project_or_404(db, meeting.project_id, caller_id)
    return meeting, project


def _validate_sprint(db: Session, project_id: int, changes: dict) -> None:
    """A linked sprint must be one of this project's."""
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


def _validate_participants(db: Session, project_id: int, user_ids: list[int]) -> list[int]:
    """Everyone listed must be a member of this project.

    Duplicates are collapsed rather than rejected — sending the same person
    twice is a client slip, not a decision worth an error — and the original
    order is kept so the list reads back the way it was chosen.
    """
    seen: list[int] = []
    for user_id in user_ids:
        if user_id in seen:
            continue
        if project_repo.get_member(db, project_id, user_id) is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "Every participant must be a member of this project",
            )
        seen.append(user_id)
    return seen


def _to_response(db: Session, meeting: Meeting) -> MeetingResponse:
    sprint_ref = None
    if meeting.sprint_id is not None:
        sprint = sprint_repo.get_by_id(db, meeting.sprint_id)
        if sprint is not None:
            sprint_ref = MeetingSprintRef(
                id=sprint.id, name=sprint.name, state=sprint.state
            )

    return MeetingResponse(
        id=meeting.id,
        project_id=meeting.project_id,
        organizer_id=meeting.organizer_id,
        organizer_name=meeting.organizer.name,
        title=meeting.title,
        description=meeting.description,
        scheduled_at=meeting.scheduled_at,
        duration_minutes=meeting.duration_minutes,
        meet_url=meeting.meet_url,
        sprint=sprint_ref,
        participants=[
            MeetingParticipantRef(
                user_id=participant.user_id,
                name=participant.user.name,
                email=participant.user.email,
            )
            for participant in meeting.participants
        ],
        created_at=meeting.created_at,
        updated_at=meeting.updated_at,
    )


# ---------- reads ----------


def list_meetings(
    db: Session, project_id: int, caller_id: int, scope: str | None = None
) -> list[MeetingResponse]:
    _get_project_or_404(db, project_id, caller_id)
    if scope is not None and scope not in SCOPES:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"scope must be one of: {', '.join(SCOPES)}",
        )
    meetings = meeting_repo.list_for_project(db, project_id, scope=scope, now=_now())
    return [_to_response(db, meeting) for meeting in meetings]


def get_meeting(db: Session, meeting_id: int, caller_id: int) -> MeetingResponse:
    meeting, _ = _get_meeting_or_404(db, meeting_id, caller_id)
    return _to_response(db, meeting)


# ---------- writes ----------


def create_meeting(
    db: Session, project_id: int, data: MeetingCreate, caller_id: int
) -> MeetingResponse:
    project = _get_project_or_404(db, project_id, caller_id)
    _require_not_archived(project)

    fields = data.model_dump()
    participant_ids = _validate_participants(db, project_id, fields.pop("participant_ids"))
    _validate_sprint(db, project_id, fields)

    meeting = meeting_repo.create(db, project_id, caller_id, **fields)
    meeting_repo.set_participants(db, meeting, participant_ids)
    db.commit()

    return _to_response(db, meeting_repo.get_by_id(db, meeting.id))


def update_meeting(
    db: Session, meeting_id: int, data: MeetingUpdate, caller_id: int
) -> MeetingResponse:
    """Organiser only, matching the author-only edit rule used elsewhere."""
    meeting, project = _get_meeting_or_404(db, meeting_id, caller_id)
    _require_not_archived(project)

    if meeting.organizer_id != caller_id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only the organizer can edit this meeting"
        )

    changes = data.model_dump(exclude_unset=True)
    if not changes:
        return _to_response(db, meeting)

    participant_ids = changes.pop("participant_ids", None)
    if participant_ids is not None:
        participant_ids = _validate_participants(db, meeting.project_id, participant_ids)

    _validate_sprint(db, meeting.project_id, changes)

    if changes:
        meeting_repo.update(db, meeting, **changes)
    if participant_ids is not None:
        meeting_repo.set_participants(db, meeting, participant_ids)
    db.commit()

    return _to_response(db, meeting_repo.get_by_id(db, meeting.id))


def delete_meeting(db: Session, meeting_id: int, caller_id: int) -> None:
    """Hard delete. The organiser may remove their own meeting; a project admin
    may remove any — the same split notes and comments use."""
    meeting, project = _get_meeting_or_404(db, meeting_id, caller_id)
    _require_not_archived(project)

    member = project_repo.get_member(db, meeting.project_id, caller_id)
    is_admin = member is not None and member.role == Role.ADMIN

    if not (meeting.organizer_id == caller_id or is_admin):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Only the organizer or an Admin can delete this meeting",
        )

    # Notes written for this meeting outlive it; the link is simply detached.
    # A dangling id would render harmlessly here but would break on any
    # database that enforces foreign keys, which SQLite does not by default.
    note_repo.clear_meeting_links(db, meeting.id)
    meeting_repo.delete(db, meeting)
    db.commit()
