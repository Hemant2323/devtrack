"""Comments endpoints (FR-6.1)."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.board import CommentCreate, CommentResponse, CommentUpdate
from app.services import comment_service

router = APIRouter(tags=["comments"])


@router.get("/issues/{issue_id}/comments", response_model=list[CommentResponse])
def list_comments(
    issue_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    rows = comment_service.list_comments(db, issue_id, me.id)
    return [
        CommentResponse(
            id=c.id,
            issue_id=c.issue_id,
            author_id=c.author_id,
            author_name=c.author.name,
            body=c.body,
            created_at=c.created_at,
            edited_at=c.edited_at,
        )
        for c in rows
    ]


@router.post(
    "/issues/{issue_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_comment(
    issue_id: int,
    data: CommentCreate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    c = comment_service.create_comment(db, issue_id, data.body, me.id)
    return CommentResponse(
        id=c.id,
        issue_id=c.issue_id,
        author_id=c.author_id,
        author_name=c.author.name,
        body=c.body,
        created_at=c.created_at,
        edited_at=c.edited_at,
    )


@router.patch("/comments/{comment_id}", response_model=CommentResponse)
def update_comment(
    comment_id: int,
    data: CommentUpdate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    c = comment_service.update_comment(db, comment_id, data.body, me.id)
    return CommentResponse(
        id=c.id,
        issue_id=c.issue_id,
        author_id=c.author_id,
        author_name=c.author.name,
        body=c.body,
        created_at=c.created_at,
        edited_at=c.edited_at,
    )


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    comment_service.delete_comment(db, comment_id, me.id)
