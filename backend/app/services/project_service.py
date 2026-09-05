"""Project business rules and RBAC (FR-2).

All permission checks live here, not in the router.
"""

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.project import Project, Role
from app.models.user import User
from app.repositories import project_repo, user_repo
from app.schemas.project import (
    ComponentCreate,
    ComponentResponse,
    MemberAdd,
    MemberResponse,
    MemberUpdate,
    ProjectCreate,
    ProjectUpdate,
)


# ---------- helpers ----------


def _get_project_or_404(db: Session, project_id: int, caller: User) -> Project:
    """Return the project, or 404.

    Returns 404 (not 403) even when the project exists but the caller is
    not a member — this prevents non-members from discovering project IDs.
    """
    project = project_repo.get_by_id(db, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    if project_repo.get_member(db, project_id, caller.id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return project


def _require_admin(db: Session, project_id: int, caller: User) -> None:
    member = project_repo.get_member(db, project_id, caller.id)
    if member is None or member.role != Role.ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin role required")


def _require_not_archived(project: Project) -> None:
    if project.archived:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Project is archived")


# ---------- projects ----------


def list_projects(db: Session, caller: User) -> list[Project]:
    return project_repo.get_all_for_user(db, caller.id)


def create_project(db: Session, data: ProjectCreate, caller: User) -> Project:
    if project_repo.get_by_key(db, data.key.upper()):
        raise HTTPException(status.HTTP_409_CONFLICT, "Project key already in use")
    return project_repo.create(db, data.name, data.key, data.description, caller.id)


def get_project(db: Session, project_id: int, caller: User) -> Project:
    return _get_project_or_404(db, project_id, caller)


def update_project(
    db: Session, project_id: int, data: ProjectUpdate, caller: User
) -> Project:
    project = _get_project_or_404(db, project_id, caller)
    _require_admin(db, project_id, caller)
    changes = data.model_dump(exclude_none=True)
    return project_repo.update(db, project, **changes)


# ---------- membership ----------


def list_members(db: Session, project_id: int, caller: User) -> list[MemberResponse]:
    _get_project_or_404(db, project_id, caller)
    rows = project_repo.get_members(db, project_id)
    return [
        MemberResponse(
            id=m.id,
            user_id=m.user_id,
            role=m.role,
            joined_at=m.joined_at,
            name=m.user.name,
            email=m.user.email,
        )
        for m in rows
    ]


def add_member(db: Session, project_id: int, data: MemberAdd, caller: User) -> MemberResponse:
    project = _get_project_or_404(db, project_id, caller)
    _require_admin(db, project_id, caller)
    _require_not_archived(project)

    target = user_repo.get_by_email(db, data.email)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No user with that email")

    try:
        member = project_repo.add_member(db, project_id, target.id, data.role)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "User is already a member")

    # reload user relationship
    member = project_repo.get_member(db, project_id, target.id)
    return MemberResponse(
        id=member.id,
        user_id=member.user_id,
        role=member.role,
        joined_at=member.joined_at,
        name=target.name,
        email=target.email,
    )


def update_member(
    db: Session, project_id: int, member_user_id: int, data: MemberUpdate, caller: User
) -> MemberResponse:
    project = _get_project_or_404(db, project_id, caller)
    _require_admin(db, project_id, caller)
    _require_not_archived(project)
    member = project_repo.get_member(db, project_id, member_user_id)
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    member = project_repo.update_member_role(db, member, data.role)
    return MemberResponse(
        id=member.id,
        user_id=member.user_id,
        role=member.role,
        joined_at=member.joined_at,
        name=member.user.name,
        email=member.user.email,
    )


def remove_member(
    db: Session, project_id: int, member_user_id: int, caller: User
) -> None:
    project = _get_project_or_404(db, project_id, caller)
    _require_admin(db, project_id, caller)
    _require_not_archived(project)
    member = project_repo.get_member(db, project_id, member_user_id)
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    project_repo.remove_member(db, member)


# ---------- components ----------


def list_components(
    db: Session, project_id: int, caller: User
) -> list[ComponentResponse]:
    _get_project_or_404(db, project_id, caller)
    return project_repo.get_components(db, project_id)


def add_component(
    db: Session, project_id: int, data: ComponentCreate, caller: User
) -> ComponentResponse:
    project = _get_project_or_404(db, project_id, caller)
    _require_admin(db, project_id, caller)
    _require_not_archived(project)
    try:
        return project_repo.add_component(
            db, project_id, data.name, data.default_assignee_id
        )
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Component name already exists in this project"
        )
