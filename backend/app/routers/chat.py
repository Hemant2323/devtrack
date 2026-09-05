"""Project chat endpoints. Routers stay thin: parse → call service → respond.

Direct messages extend the existing shape rather than replacing it. Reading
and sending are per-conversation, so they hang off the project as
`/projects/{id}/chat/dm/...` beside `/projects/{id}/chat`. Editing and
deleting address one message by id, which already identifies its conversation,
so `PATCH`/`DELETE /chat/{message_id}` serve both kinds unchanged — the
service decides what the caller is allowed to do with the message it finds.
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.chat import ChatMessage
from app.models.user import User
from app.schemas.chat import (
    ChatMessageCreate,
    ChatMessageResponse,
    ChatMessageUpdate,
    DmPartnerResponse,
)
from app.services import chat_service

router = APIRouter(tags=["chat"])


def _to_response(message: ChatMessage) -> ChatMessageResponse:
    """author_name is denormalised onto the response so the client needs no
    separate user lookup — the same shape CommentResponse uses. recipient_name
    follows suit, and stays None on a team-chat message."""
    return ChatMessageResponse(
        id=message.id,
        project_id=message.project_id,
        author_id=message.author_id,
        author_name=message.author.name,
        recipient_id=message.recipient_id,
        recipient_name=message.recipient.name if message.recipient_id else None,
        body=message.body,
        created_at=message.created_at,
        edited_at=message.edited_at,
    )


# ---------- team chat ----------


@router.get("/projects/{project_id}/chat", response_model=list[ChatMessageResponse])
def list_messages(
    project_id: int,
    limit: int = Query(chat_service.DEFAULT_LIMIT, ge=1, le=chat_service.MAX_LIMIT),
    before_id: int | None = Query(None),
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """The most recent team messages, oldest-first for display. Direct messages
    are never included.

    `before_id` walks backwards for older history; it is an id cursor scoped to
    this endpoint, not general pagination.
    """
    rows = chat_service.list_messages(db, project_id, me.id, limit, before_id)
    return [_to_response(row) for row in rows]


@router.post(
    "/projects/{project_id}/chat",
    response_model=ChatMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
def send_message(
    project_id: int,
    data: ChatMessageCreate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    return _to_response(chat_service.send_message(db, project_id, data, me.id))


# ---------- direct messages ----------


@router.get("/projects/{project_id}/chat/dm", response_model=list[DmPartnerResponse])
def list_dm_partners(
    project_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Who the caller can DM in this project, conversations they already have
    first."""
    return chat_service.list_dm_partners(db, project_id, me.id)


@router.get(
    "/projects/{project_id}/chat/dm/{user_id}",
    response_model=list[ChatMessageResponse],
)
def list_direct_messages(
    project_id: int,
    user_id: int,
    limit: int = Query(chat_service.DEFAULT_LIMIT, ge=1, le=chat_service.MAX_LIMIT),
    before_id: int | None = Query(None),
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """The conversation between the caller and `user_id`, oldest-first.

    The caller is always one participant, so there is no way to address someone
    else's thread — including through `before_id`, which narrows this
    conversation rather than selecting across others.
    """
    rows = chat_service.list_direct_messages(
        db, project_id, user_id, me.id, limit, before_id
    )
    return [_to_response(row) for row in rows]


@router.post(
    "/projects/{project_id}/chat/dm/{user_id}",
    response_model=ChatMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
def send_direct_message(
    project_id: int,
    user_id: int,
    data: ChatMessageCreate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    return _to_response(
        chat_service.send_direct_message(db, project_id, user_id, data, me.id)
    )


# ---------- edit + delete (team chat and DMs alike) ----------


@router.patch("/chat/{message_id}", response_model=ChatMessageResponse)
def edit_message(
    message_id: int,
    data: ChatMessageUpdate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    return _to_response(chat_service.edit_message(db, message_id, data, me.id))


@router.delete("/chat/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_message(
    message_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    chat_service.delete_message(db, message_id, me.id)
