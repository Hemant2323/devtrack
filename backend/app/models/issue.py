"""Issue, Sprint, and Activity models (FR-3, FR-5 schema, FR-6.2)."""

import enum
from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# ---------- enums ----------


class IssueType(str, enum.Enum):
    TASK = "TASK"
    BUG = "BUG"


class Status(str, enum.Enum):
    TODO = "TODO"
    IN_PROGRESS = "IN_PROGRESS"
    TESTING = "TESTING"
    DONE = "DONE"


class Priority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Severity(str, enum.Enum):
    """Bug-only field (nullable on TASK rows)."""
    MINOR = "MINOR"
    MAJOR = "MAJOR"
    CRITICAL = "CRITICAL"
    BLOCKER = "BLOCKER"


class SprintState(str, enum.Enum):
    PLANNED = "PLANNED"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"


# ---------- Sprint ----------


class Sprint(Base):
    """Sprint is declared first because Issue has a FK to it.

    The "one active sprint per project" rule is enforced in the service
    layer (sprint_service.start_sprint). A DB-level partial unique index
    would be cleaner but requires Postgres syntax not portable to SQLite;
    the service check is sufficient for v1.0.
    """

    __tablename__ = "sprints"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    goal: Mapped[str] = mapped_column(Text, default="")
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    state: Mapped[SprintState] = mapped_column(
        Enum(SprintState), default=SprintState.PLANNED
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


# ---------- Issue ----------


class Issue(Base):
    """Single table for tasks AND bugs (type discriminator = `type` column).

    Design rationale (documented in 03-Architecture.md):
    - shared Kanban workflow, comments, activity log → no duplication
    - bug-only columns (severity, steps_to_reproduce) are nullable
    - key is "DEV-42" built as f"{project.key}-{number}" in the service layer
    """

    __tablename__ = "issues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    # null = backlog; set = belongs to that sprint
    sprint_id: Mapped[int | None] = mapped_column(
        ForeignKey("sprints.id"), nullable=True, index=True
    )
    # Sequential per-project number — the "42" part of "DEV-42".
    # Unique with project_id so keys never collide.
    number: Mapped[int] = mapped_column(Integer)

    type: Mapped[IssueType] = mapped_column(Enum(IssueType))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[Status] = mapped_column(
        Enum(Status), default=Status.TODO, index=True
    )
    priority: Mapped[Priority] = mapped_column(Enum(Priority), default=Priority.MEDIUM)

    # Bug-only (nullable for TASK rows)
    severity: Mapped[Severity | None] = mapped_column(Enum(Severity), nullable=True)
    steps_to_reproduce: Mapped[str | None] = mapped_column(Text, nullable=True)

    component_id: Mapped[int | None] = mapped_column(
        ForeignKey("components.id"), nullable=True
    )
    assignee_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    reporter_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Soft delete: deleted_at IS NULL means "alive" (FR-3.5)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    activities: Mapped[list["Activity"]] = relationship(
        back_populates="issue", order_by="Activity.created_at"
    )


# ---------- Activity ----------


class Activity(Base):
    """Immutable audit log entry per issue (FR-6.2, NFR-10).

    Never updated or deleted — only inserted. The service layer is the
    only place that should call activity_repo.log().
    """

    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    issue_id: Mapped[int] = mapped_column(ForeignKey("issues.id"), index=True)
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    # Short verb: "created", "status_changed", "field_changed", "commented", etc.
    action: Mapped[str] = mapped_column(String(30))
    # Optional field tracking (e.g. action="field_changed", field="priority")
    field: Mapped[str | None] = mapped_column(String(30), nullable=True)
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    issue: Mapped[Issue] = relationship(back_populates="activities")
