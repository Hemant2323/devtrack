"""Project aggregate: projects, memberships (RBAC), components (FR-2)."""

import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, utcnow


class Role(str, enum.Enum):
    """A user's role WITHIN one project (SRS §2.3) — not global."""

    ADMIN = "ADMIN"
    DEVELOPER = "DEVELOPER"
    TESTER = "TESTER"


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    # Short uppercase code, unique across the system: "DEV" → issues DEV-1, DEV-2…
    key: Mapped[str] = mapped_column(String(10), unique=True, index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    # Source of sequential issue numbers (Sprint 2); incremented atomically.
    issue_counter: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    members: Mapped[list["ProjectMember"]] = relationship(back_populates="project")
    components: Mapped[list["Component"]] = relationship()


class ProjectMember(Base):
    __tablename__ = "project_members"
    # A user can be in a project only once (TC-PRJ-03).
    __table_args__ = (UniqueConstraint("project_id", "user_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[Role] = mapped_column(Enum(Role))
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    project: Mapped[Project] = relationship(back_populates="members")
    user = relationship("User")


class Component(Base):
    """Project area used to classify issues (e.g. Payment, Auth, UI).
    default_assignee feeds the AI triage assignee suggestion (Sprint 5)."""

    __tablename__ = "components"
    __table_args__ = (UniqueConstraint("project_id", "name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    name: Mapped[str] = mapped_column(String(50))
    default_assignee_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
