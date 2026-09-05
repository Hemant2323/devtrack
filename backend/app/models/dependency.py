"""Issue dependency model (Sprint 6).

One row means: `blocking_issue` must be resolved before `blocked_issue` can
be. Read in both directions from either end —

    BUG-18 blocks BUG-24        (from BUG-18's side)
    BUG-24 is blocked by BUG-18 (from BUG-24's side)

— so a single directed edge serves both lists and there is no second table
and no inverse row to keep in step.

Deliberately informational: nothing in the codebase reads these rows to
change a status, gate a transition, or reorder a sprint. The team decides
what to do about a blocker.

The pair is unique at the database level so a duplicate cannot be created by
two concurrent requests slipping past the service check. Self-blocking and
cycles are service-level rules; expressing them in SQL is not portable, and
a cycle is a graph property no constraint can see.
"""

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class IssueDependency(Base):
    __tablename__ = "issue_dependencies"
    __table_args__ = (
        UniqueConstraint(
            "blocking_issue_id", "blocked_issue_id", name="uq_issue_dependency_pair"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # The issue that must be resolved first.
    blocking_issue_id: Mapped[int] = mapped_column(
        ForeignKey("issues.id"), index=True
    )
    # The issue that is waiting on it.
    blocked_issue_id: Mapped[int] = mapped_column(ForeignKey("issues.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    # Two paths to issues, so each relationship names its own column.
    blocking_issue = relationship("Issue", foreign_keys=[blocking_issue_id])
    blocked_issue = relationship("Issue", foreign_keys=[blocked_issue_id])
