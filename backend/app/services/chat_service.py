"""Project chat business rules, for both team chat and direct messages.

Authorization reuses the existing project conventions exactly: any project
member may read and post, a non-member gets 404 rather than 403 (existence
hiding), an archived project rejects every write, and editing is the author's
alone.

Direct messages add one rule and change one:

* Added — a DM is visible only to its two participants. A project member who
  is neither gets 404 for it, the same answer they would get for a message
  that does not exist, so guessing message ids reveals nothing.
* Changed — the admin delete override applies to team chat only. An admin
  cannot read a DM, so letting them delete one would be moderation of content
  they cannot see; within a DM only the author may delete.
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.chat import ChatMessage
from app.models.project import Role
from app.repositories import chat_repo, project_repo
from app.schemas.chat import ChatMessageCreate, ChatMessageUpdate, DmPartnerResponse

# Keeps one poll's payload bounded. Chat is the first endpoint in the codebase
# where unbounded growth is inevitable rather than merely possible.
DEFAULT_LIMIT = 50
MAX_LIMIT = 100


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


def _require_dm_partner(db: Session, project_id: int, other_id: int, caller_id: int):
    """Validate the other end of a DM: a real member of this same project, and
    not the caller themselves."""
    if other_id == caller_id:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Cannot send a direct message to yourself",
        )
    member = project_repo.get_member(db, project_id, other_id)
    if member is None:
        # 404, not 403 — a user who is not in this project has no DM thread in
        # it to speak of, and their membership elsewhere is not disclosed.
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "User is not a member of this project"
        )
    return member


def _get_message_or_404(db: Session, message_id: int, caller_id: int):
    """Return (message, project), or 404 if it does not exist, the caller is
    not a member of its project, or it is a DM the caller is not part of.

    The last case is what stops a project member from reaching another pair's
    private message by guessing its id.
    """
    message = chat_repo.get_by_id(db, message_id)
    if message is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found")
    project = _get_project_or_404(db, message.project_id, caller_id)

    if message.recipient_id is not None and caller_id not in (
        message.author_id,
        message.recipient_id,
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found")

    return message, project


# ---------- team chat ----------


def list_messages(
    db: Session,
    project_id: int,
    caller_id: int,
    limit: int = DEFAULT_LIMIT,
    before_id: int | None = None,
) -> list[ChatMessage]:
    _get_project_or_404(db, project_id, caller_id)
    bounded = max(1, min(limit, MAX_LIMIT))
    return chat_repo.list_for_project(
        db, project_id, limit=bounded, before_id=before_id
    )


def send_message(
    db: Session, project_id: int, data: ChatMessageCreate, caller_id: int
) -> ChatMessage:
    project = _get_project_or_404(db, project_id, caller_id)
    _require_not_archived(project)

    message = chat_repo.create(db, project_id, caller_id, data.body)
    db.commit()
    db.refresh(message)
    return message


# ---------- direct messages ----------


def list_direct_messages(
    db: Session,
    project_id: int,
    other_user_id: int,
    caller_id: int,
    limit: int = DEFAULT_LIMIT,
    before_id: int | None = None,
) -> list[ChatMessage]:
    _get_project_or_404(db, project_id, caller_id)
    _require_dm_partner(db, project_id, other_user_id, caller_id)
    bounded = max(1, min(limit, MAX_LIMIT))
    # The caller is always one half of the pair passed to the query, so a
    # thread they are not part of cannot be addressed at all.
    return chat_repo.list_direct(
        db, project_id, caller_id, other_user_id, limit=bounded, before_id=before_id
    )


def send_direct_message(
    db: Session,
    project_id: int,
    recipient_id: int,
    data: ChatMessageCreate,
    caller_id: int,
) -> ChatMessage:
    project = _get_project_or_404(db, project_id, caller_id)
    _require_dm_partner(db, project_id, recipient_id, caller_id)
    _require_not_archived(project)

    message = chat_repo.create(
        db, project_id, caller_id, data.body, recipient_id=recipient_id
    )
    db.commit()
    db.refresh(message)
    return message


def list_dm_partners(
    db: Session, project_id: int, caller_id: int
) -> list[DmPartnerResponse]:
    """Every other member of the project, carrying the caller's last message
    with them where a conversation exists.

    One list rather than two endpoints: starting a new conversation and
    resuming an old one are the same action from the user's side, and the
    member list is small and already loaded elsewhere in the app.
    """
    _get_project_or_404(db, project_id, caller_id)

    last_by_partner: dict[int, ChatMessage] = {}
    for message in chat_repo.list_dm_last_messages(db, project_id, caller_id):
        partner = (
            message.recipient_id
            if message.author_id == caller_id
            else message.author_id
        )
        # Rows arrive newest-first, so the first one seen for a partner wins.
        last_by_partner.setdefault(partner, message)

    partners = [
        DmPartnerResponse(
            user_id=member.user_id,
            name=member.user.name,
            email=member.user.email,
            last_message_at=(
                last_by_partner[member.user_id].created_at
                if member.user_id in last_by_partner
                else None
            ),
            last_message_body=(
                last_by_partner[member.user_id].body
                if member.user_id in last_by_partner
                else None
            ),
        )
        for member in project_repo.get_members(db, project_id)
        if member.user_id != caller_id
    ]

    # Active conversations first, most recent at the top; everyone else after,
    # alphabetically, as a directory to start from.
    def order(partner: DmPartnerResponse):
        started = partner.user_id in last_by_partner
        return (
            0 if started else 1,
            -last_by_partner[partner.user_id].id if started else 0,
            partner.name.lower(),
        )

    partners.sort(key=order)
    return partners


# ---------- edit + delete (both kinds) ----------


def edit_message(
    db: Session, message_id: int, data: ChatMessageUpdate, caller_id: int
) -> ChatMessage:
    message, project = _get_message_or_404(db, message_id, caller_id)
    _require_not_archived(project)

    if message.author_id != caller_id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only the author can edit this message"
        )

    message = chat_repo.update(db, message, data.body)
    db.commit()
    db.refresh(message)
    return message


def delete_message(db: Session, message_id: int, caller_id: int) -> None:
    """Hard delete. In team chat the author may remove their own message and a
    project admin may remove any — the same moderation split comments use. In a
    DM there is nothing for an admin to moderate, because they cannot read it,
    so the author alone may delete.
    """
    message, project = _get_message_or_404(db, message_id, caller_id)
    _require_not_archived(project)

    is_dm = message.recipient_id is not None
    allowed = message.author_id == caller_id

    if not allowed and not is_dm:
        member = project_repo.get_member(db, message.project_id, caller_id)
        allowed = member is not None and member.role == Role.ADMIN

    if not allowed:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Only the author can delete this message"
            if is_dm
            else "Only the author or an Admin can delete this message",
        )

    chat_repo.delete(db, message)
    db.commit()
