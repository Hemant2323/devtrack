"""Issue dependency endpoints (Sprint 6). Routers stay thin.

Naming follows the issue conventions already in place: a collection hangs off
its owner (`/issues/{id}/dependencies`, like `/issues/{id}/comments`), and a
single row is addressed by its own id (`/dependencies/{id}`, like
`/comments/{id}`). The project-wide list mirrors the other project-scoped
reads and exists so the board can mark blocked cards in one request.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.dependency import (
    DependencyCreate,
    DependencyLink,
    IssueDependenciesResponse,
    ProjectDependencyEdge,
)
from app.services import dependency_service

router = APIRouter(tags=["dependencies"])


@router.get("/issues/{issue_id}/dependencies", response_model=IssueDependenciesResponse)
def list_dependencies(
    issue_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """What blocks this issue, and what it blocks."""
    return dependency_service.list_dependencies(db, issue_id, me.id)


@router.post(
    "/issues/{issue_id}/dependencies",
    response_model=DependencyLink,
    status_code=status.HTTP_201_CREATED,
)
def create_dependency(
    issue_id: int,
    data: DependencyCreate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Link this issue to another one. `direction` says which way round.

    409 if the link already exists; 422 for a self-link, a cross-project link,
    or one that would close a cycle.
    """
    return dependency_service.create_dependency(db, issue_id, data, me.id)


@router.delete("/dependencies/{dependency_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dependency(
    dependency_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    dependency_service.delete_dependency(db, dependency_id, me.id)


@router.get(
    "/projects/{project_id}/dependencies",
    response_model=list[ProjectDependencyEdge],
)
def list_project_dependencies(
    project_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Every dependency edge in the project, with each blocker's status.

    The board reads this once and marks any card that has a blocker which is
    not yet DONE — no per-card request.
    """
    return dependency_service.list_project_dependencies(db, project_id, me.id)
