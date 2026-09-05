"""Sprint endpoints (FR-5). Routers stay thin: parse → call service → respond."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.sprint import (
    SprintCreate,
    SprintReport,
    SprintResponse,
    SprintUpdate,
)
from app.services import sprint_service

router = APIRouter(tags=["sprints"])


# ---------- project-scoped: list + create ----------


@router.get("/projects/{project_id}/sprints", response_model=list[SprintResponse])
def list_sprints(
    project_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    return sprint_service.list_sprints(db, project_id, me)


@router.post(
    "/projects/{project_id}/sprints",
    response_model=SprintResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_sprint(
    project_id: int,
    data: SprintCreate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    return sprint_service.create_sprint(db, project_id, data, me)


# ---------- sprint-scoped: get, update, lifecycle ----------


@router.get("/sprints/{sprint_id}", response_model=SprintResponse)
def get_sprint(
    sprint_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    return sprint_service.get_sprint(db, sprint_id, me)


@router.patch("/sprints/{sprint_id}", response_model=SprintResponse)
def update_sprint(
    sprint_id: int,
    data: SprintUpdate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    return sprint_service.update_sprint(db, sprint_id, data, me)


@router.post("/sprints/{sprint_id}/start", response_model=SprintResponse)
def start_sprint(
    sprint_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """PLANNED → ACTIVE. Only one sprint per project may be active (FR-5.3)."""
    return sprint_service.start_sprint(db, sprint_id, me)


@router.post("/sprints/{sprint_id}/complete", response_model=SprintReport)
def complete_sprint(
    sprint_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """ACTIVE → COMPLETED. Unfinished issues return to the backlog and the
    completed-vs-planned report is returned (FR-5.4)."""
    return sprint_service.complete_sprint(db, sprint_id, me)
