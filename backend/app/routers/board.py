"""Kanban board endpoint (FR-4).

Returns issues grouped into four columns without touching the DB again —
it reuses list_for_project from issue_service.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.repositories import issue_repo, project_repo
from app.services.issue_service import _get_project_member_or_404, _to_response
from app.models.issue import Status
from fastapi import HTTPException, status as http_status

router = APIRouter(tags=["board"])


@router.get("/projects/{project_id}/board")
def get_board(
    project_id: int,
    sprint_id: int | None = Query(None),
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Issues grouped by status column. Optionally filtered to a sprint."""
    project, _ = _get_project_member_or_404(db, project_id, me.id)
    issues = issue_repo.list_for_project(
        db, project_id, sprint_id=sprint_id
    )
    responses = [_to_response(i, project.key) for i in issues]

    board = {
        "todo": [],
        "in_progress": [],
        "testing": [],
        "done": [],
    }
    mapping = {
        Status.TODO: "todo",
        Status.IN_PROGRESS: "in_progress",
        Status.TESTING: "testing",
        Status.DONE: "done",
    }
    for r in responses:
        col = mapping.get(r.status)
        if col:
            board[col].append(r)

    return board
