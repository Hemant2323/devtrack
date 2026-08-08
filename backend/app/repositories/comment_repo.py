"""Comment queries."""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.notification import Comment


def get_by_id(db: Session, comment_id: int) -> Comment | None:
    return db.get(Comment, comment_id)


def list_for_issue(db: Session, issue_id: int) -> list[Comment]:
    return list(
        db.scalars(
            select(Comment)
            .where(Comment.issue_id == issue_id)
            .options(selectinload(Comment.author))
            .order_by(Comment.created_at)
        )
    )


def create(db: Session, issue_id: int, author_id: int, body: str) -> Comment:
    c = Comment(issue_id=issue_id, author_id=author_id, body=body)
    db.add(c)
    db.flush()
    return c


def update(db: Session, comment: Comment, body: str) -> Comment:
    comment.body = body
    comment.edited_at = datetime.now(timezone.utc)
    db.flush()
    return comment


def delete(db: Session, comment: Comment) -> None:
    db.delete(comment)
    db.flush()
