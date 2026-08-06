"""Projects, membership, and components endpoints (FR-2)."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.project import (
    ComponentCreate,
    ComponentResponse,
    MemberAdd,
    MemberResponse,
    MemberUpdate,
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
)
from app.services import project_service

router = APIRouter(prefix="/projects", tags=["projects"])


# ---------- projects ----------


@router.get("", response_model=list[ProjectResponse])
def list_projects(
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    return project_service.list_projects(db, me)


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    data: ProjectCreate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    return project_service.create_project(db, data, me)


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    return project_service.get_project(db, project_id, me)


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    data: ProjectUpdate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    return project_service.update_project(db, project_id, data, me)


# ---------- membership ----------


@router.get("/{project_id}/members", response_model=list[MemberResponse])
def list_members(
    project_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    return project_service.list_members(db, project_id, me)


@router.post(
    "/{project_id}/members",
    response_model=MemberResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_member(
    project_id: int,
    data: MemberAdd,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    return project_service.add_member(db, project_id, data, me)


@router.patch("/{project_id}/members/{user_id}", response_model=MemberResponse)
def update_member(
    project_id: int,
    user_id: int,
    data: MemberUpdate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    return project_service.update_member(db, project_id, user_id, data, me)


@router.delete("/{project_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    project_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    project_service.remove_member(db, project_id, user_id, me)


# ---------- components ----------


@router.get("/{project_id}/components", response_model=list[ComponentResponse])
def list_components(
    project_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    return project_service.list_components(db, project_id, me)


@router.post(
    "/{project_id}/components",
    response_model=ComponentResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_component(
    project_id: int,
    data: ComponentCreate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    return project_service.add_component(db, project_id, data, me)
