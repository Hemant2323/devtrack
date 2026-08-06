"""All database queries for projects, members, and components."""

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.project import Component, Project, ProjectMember, Role


# ---------- projects ----------


def get_all_for_user(db: Session, user_id: int) -> list[Project]:
    """All projects the user is a member of."""
    return list(
        db.scalars(
            select(Project)
            .join(ProjectMember, ProjectMember.project_id == Project.id)
            .where(ProjectMember.user_id == user_id)
            .order_by(Project.created_at.desc())
        )
    )


def get_by_id(db: Session, project_id: int) -> Project | None:
    return db.get(Project, project_id)


def get_by_key(db: Session, key: str) -> Project | None:
    return db.scalar(select(Project).where(Project.key == key))


def create(db: Session, name: str, key: str, description: str, owner_id: int) -> Project:
    project = Project(name=name, key=key.upper(), description=description)
    db.add(project)
    db.flush()  # gets the project.id without committing yet
    # Creator becomes Admin (FR-2.1)
    db.add(ProjectMember(project_id=project.id, user_id=owner_id, role=Role.ADMIN))
    db.commit()
    db.refresh(project)
    return project


def update(db: Session, project: Project, **fields) -> Project:
    for k, v in fields.items():
        setattr(project, k, v)
    db.commit()
    db.refresh(project)
    return project


# ---------- membership ----------


def get_member(db: Session, project_id: int, user_id: int) -> ProjectMember | None:
    return db.scalar(
        select(ProjectMember)
        .where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )


def get_members(db: Session, project_id: int) -> list[ProjectMember]:
    return list(
        db.scalars(
            select(ProjectMember)
            .where(ProjectMember.project_id == project_id)
            .options(selectinload(ProjectMember.user))
        )
    )


def add_member(db: Session, project_id: int, user_id: int, role: Role) -> ProjectMember:
    member = ProjectMember(project_id=project_id, user_id=user_id, role=role)
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


def update_member_role(db: Session, member: ProjectMember, role: Role) -> ProjectMember:
    member.role = role
    db.commit()
    db.refresh(member)
    return member


def remove_member(db: Session, member: ProjectMember) -> None:
    db.delete(member)
    db.commit()


# ---------- components ----------


def get_components(db: Session, project_id: int) -> list[Component]:
    return list(
        db.scalars(select(Component).where(Component.project_id == project_id))
    )


def add_component(
    db: Session, project_id: int, name: str, default_assignee_id: int | None
) -> Component:
    comp = Component(
        project_id=project_id, name=name, default_assignee_id=default_assignee_id
    )
    db.add(comp)
    db.commit()
    db.refresh(comp)
    return comp
