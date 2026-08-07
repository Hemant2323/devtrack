"""Issues and activity history endpoints (FR-3, FR-6.2)."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.issue import IssueType, Priority, Severity, Status
from app.models.user import User
from app.schemas.issue import ActivityResponse, IssueCreate, IssueResponse, IssueUpdate
from app.services import issue_service

router = APIRouter(tags=["issues"])


# ---------- project-scoped: list + create ----------


@router.get("/projects/{project_id}/issues", response_model=list[IssueResponse])
def list_issues(
    project_id: int,
    status_: Status | None = Query(None, alias="status"),
    type_: IssueType | None = Query(None, alias="type"),
    priority: Priority | None = None,
    assignee_id: int | None = None,
    sprint_id: int | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    return issue_service.list_issues(
        db,
        project_id,
        me.id,
        status=status_,
        type_=type_,
        priority=priority,
        assignee_id=assignee_id,
        sprint_id=sprint_id,
        q=q,
    )


@router.post(
    "/projects/{project_id}/issues",
    response_model=IssueResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_issue(
    project_id: int,
    data: IssueCreate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    return issue_service.create_issue(db, project_id, data, me.id)


# ---------- issue-scoped: get, update, delete, activity ----------


@router.get("/issues/{issue_id}", response_model=IssueResponse)
def get_issue(
    issue_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    return issue_service.get_issue(db, issue_id, me.id)


@router.patch("/issues/{issue_id}", response_model=IssueResponse)
def update_issue(
    issue_id: int,
    data: IssueUpdate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    return issue_service.update_issue(db, issue_id, data, me.id)


@router.delete("/issues/{issue_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_issue(
    issue_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    issue_service.delete_issue(db, issue_id, me.id)


@router.get("/issues/{issue_id}/activities", response_model=list[ActivityResponse])
def get_activities(
    issue_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    return issue_service.get_activities(db, issue_id, me.id)
