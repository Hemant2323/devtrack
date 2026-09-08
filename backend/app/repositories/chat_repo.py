"""Project chat queries.

One table holds both conversation kinds, so the `recipient_id` predicate is
what separates them and every query below states it explicitly:

  team chat -> recipient_id IS NULL
  a DM      -> recipient_id IS NOT NULL, and the (author, recipient) pair
               matches the two participants in either direction

This module is the only place that builds queries against chat_messages, so
those two predicates are not repeated anywhere else in the codebase.
"""


from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import utcnow
from app.models.chat import ChatMessage


def get_by_id(db: Session, message_id: int) -> ChatMessage | None:
    return db.get(ChatMessage, message_id)


def _dm_pair(project_id: int, user_a: int, user_b: int):
    """Messages of one DM thread, regardless of who sent which."""
    return and_(
        ChatMessage.project_id == project_id,
        ChatMessage.recipient_id.is_not(None),
        or_(
            and_(
                ChatMessage.author_id == user_a,
                ChatMessage.recipient_id == user_b,
            ),
            and_(
                ChatMessage.author_id == user_b,
                ChatMessage.recipient_id == user_a,
            ),
        ),
    )


def _take_window(
    db: Session, stmt, limit: int, before_id: int | None
) -> list[ChatMessage]:
    """Take the newest `limit` rows of an already-scoped query and return them
    oldest-first for display.

    The window is taken from the newest end (ORDER BY id DESC + LIMIT) and then
    reversed, so a busy conversation returns its tail rather than its
    beginning. `before_id` walks backwards from a known message to fetch older
    history; it is an id cursor on these endpoints only, not a general
    pagination framework. It narrows the scope the caller already applied
    rather than replacing it, so paging can never cross into another
    conversation.
    """
    if before_id is not None:
        stmt = stmt.where(ChatMessage.id < before_id)
    stmt = (
        # Both names are denormalised onto the response, so both are eager-
        # loaded; on team chat every recipient_id is NULL and the second load
        # costs no query at all.
        stmt.options(
            selectinload(ChatMessage.author), selectinload(ChatMessage.recipient)
        )
        .order_by(ChatMessage.id.desc())
        .limit(limit)
    )

    newest_first = list(db.scalars(stmt))
    newest_first.reverse()
    return newest_first


def list_for_project(
    db: Session,
    project_id: int,
    *,
    limit: int = 50,
    before_id: int | None = None,
) -> list[ChatMessage]:
    """Team chat only. The IS NULL is what keeps direct messages out of it."""
    stmt = select(ChatMessage).where(
        ChatMessage.project_id == project_id,
        ChatMessage.recipient_id.is_(None),
    )
    return _take_window(db, stmt, limit, before_id)


def list_direct(
    db: Session,
    project_id: int,
    user_a: int,
    user_b: int,
    *,
    limit: int = 50,
    before_id: int | None = None,
) -> list[ChatMessage]:
    """One DM thread within one project."""
    stmt = select(ChatMessage).where(_dm_pair(project_id, user_a, user_b))
    return _take_window(db, stmt, limit, before_id)


def list_dm_last_messages(
    db: Session, project_id: int, user_id: int
) -> list[ChatMessage]:
    """The newest message of each DM thread the user takes part in, newest
    thread first.

    Grouping on the *other* participant collapses both directions of a thread
    into one row, so the id of each group's newest message is found in one
    query and those rows are then loaded in a second.
    """
    partner_id = case(
        (ChatMessage.author_id == user_id, ChatMessage.recipient_id),
        else_=ChatMessage.author_id,
    )
    newest_per_thread = (
        select(func.max(ChatMessage.id))
        .where(
            ChatMessage.project_id == project_id,
            ChatMessage.recipient_id.is_not(None),
            or_(
                ChatMessage.author_id == user_id,
                ChatMessage.recipient_id == user_id,
            ),
        )
        .group_by(partner_id)
    )
    return list(
        db.scalars(
            select(ChatMessage)
            .where(ChatMessage.id.in_(newest_per_thread))
            .order_by(ChatMessage.id.desc())
        )
    )


def create(
    db: Session,
    project_id: int,
    author_id: int,
    body: str,
    recipient_id: int | None = None,
) -> ChatMessage:
    """`recipient_id` left at None writes a team-chat message, which is what
    every existing caller does."""
    message = ChatMessage(
        project_id=project_id,
        author_id=author_id,
        recipient_id=recipient_id,
        body=body,
    )
    db.add(message)
    db.flush()
    return message


def update(db: Session, message: ChatMessage, body: str) -> ChatMessage:
    message.body = body
    message.edited_at = utcnow()
    db.flush()
    return message


def delete(db: Session, message: ChatMessage) -> None:
    """Hard delete, consistent with comments."""
    db.delete(message)
    db.flush()
