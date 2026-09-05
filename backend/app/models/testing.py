"""Test case and test run models (FR-9)."""

import enum
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TestResult(str, enum.Enum):
    """The three outcomes FR-9.2 names. BLOCKED means the run could not be
    carried out, which is distinct from a failure."""

    PASS = "PASS"
    FAIL = "FAIL"
    BLOCKED = "BLOCKED"


class TestCase(Base):
    """A repeatable check, owned by a project (FR-9.1).

    `issue_id` is optional: a test case may verify a specific issue, or stand
    on its own as part of the project's regression set.
    """

    __tablename__ = "test_cases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    # Optional link to the issue this case verifies.
    issue_id: Mapped[int | None] = mapped_column(
        ForeignKey("issues.id"), nullable=True, index=True
    )

    title: Mapped[str] = mapped_column(String(200))
    preconditions: Mapped[str] = mapped_column(Text, default="")
    steps: Mapped[str] = mapped_column(Text, default="")
    expected_result: Mapped[str] = mapped_column(Text, default="")

    # Sprint 6.5: when this case is due to be run. The same shape and type as
    # Issue.deadline, so both render and edit identically on the calendar.
    # Nullable: most cases are part of a standing regression set with no date.
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)

    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    runs: Mapped[list["TestRun"]] = relationship(
        back_populates="test_case", order_by="TestRun.executed_at.desc()"
    )


class TestRun(Base):
    """One execution of a test case (FR-9.2).

    Runs are an append-only history: recording a new run never edits an older
    one, so the sequence of results over time stays intact.

    `issue_id` records the bug raised from a failing run, so the one-click
    shortcut in FR-9.2 is traceable and can only be used once per run.
    """

    __tablename__ = "test_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    test_case_id: Mapped[int] = mapped_column(ForeignKey("test_cases.id"), index=True)

    result: Mapped[TestResult] = mapped_column(Enum(TestResult))
    notes: Mapped[str] = mapped_column(Text, default="")

    # The bug created from this run, if the shortcut was used.
    issue_id: Mapped[int | None] = mapped_column(
        ForeignKey("issues.id"), nullable=True
    )

    executed_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    executed_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    test_case: Mapped[TestCase] = relationship(back_populates="runs")
