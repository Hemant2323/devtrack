"""Comment business rules (FR-6.1)."""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.notification import NotifType
from app.repositories import activity_repo, comment_repo, project_repo
from app.repositories.issue_repo import get_by_id as get_issue
from app.services import notification_service


def _get_issue_or_404(db, issue_id, caller_id):
    issue = get_issue(db, issue_id)
    if issue is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Issue not found")
    if project_repo.get_member(db, issue.project_id, caller_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Issue not found")
    return issue


def _require_not_archived(db, issue) -> None:
    project = project_repo.get_by_id(db, issue.project_id)
    if project.archived:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Project is archived")


def list_comments(db: Session, issue_id: int, caller_id: int):
    _get_issue_or_404(db, issue_id, caller_id)
    return comment_repo.list_for_issue(db, issue_id)


def create_comment(db: Session, issue_id: int, body: str, caller_id: int):
    issue = _get_issue_or_404(db, issue_id, caller_id)
    project = project_repo.get_by_id(db, issue.project_id)
    if project.archived:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Project is archived")

    comment = comment_repo.create(db, issue_id, caller_id, body)

    # Log activity on the issue
    activity_repo.log(db, issue_id, caller_id, "commented",
                      new_value=body[:200] if len(body) > 200 else body)

    # Notify assignee about the comment (if different from commenter)
    if issue.assignee_id and issue.assignee_id != caller_id:
        notification_service.notify(
            db, issue.assignee_id, NotifType.MENTION,
            f"New comment on {project.key}-{issue.number}", issue_id
        )

    db.commit()
    db.refresh(comment)
    return comment


def update_comment(db: Session, comment_id: int, body: str, caller_id: int):
    comment = comment_repo.get_by_id(db, comment_id)
    if comment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comment not found")
    # Resolve through the issue so a non-member gets 404 rather than a 403 that
    # would confirm the comment exists, and so an archived project is refused.
    issue = _get_issue_or_404(db, comment.issue_id, caller_id)
    _require_not_archived(db, issue)
    # Only the author can edit (FR-6.1)
    if comment.author_id != caller_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the author can edit this comment")
    comment = comment_repo.update(db, comment, body)
    db.commit()
    db.refresh(comment)
    return comment


def delete_comment(db: Session, comment_id: int, caller_id: int) -> None:
    comment = comment_repo.get_by_id(db, comment_id)
    if comment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comment not found")

    issue = _get_issue_or_404(db, comment.issue_id, caller_id)
    _require_not_archived(db, issue)
    member = project_repo.get_member(db, issue.project_id, caller_id)

    from app.models.project import Role
    is_admin = member and member.role == Role.ADMIN
    is_author = comment.author_id == caller_id

    if not (is_author or is_admin):
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            "Only the author or an Admin can delete this comment")
    comment_repo.delete(db, comment)
    db.commit()
