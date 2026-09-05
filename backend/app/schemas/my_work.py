"""Response shapes for My Work (Sprint 6).

Nothing here is stored. Every field is read from an issue, a test case, a
sprint or a meeting at request time and normalised into one shape, so My Work
can never hold a stale copy of work it does not own.
"""

import enum
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.issue import IssueType, Priority, SprintState, Status
from app.models.testing import TestResult


class WorkItemType(str, enum.Enum):
    """The two kinds of work a person is on the hook for."""

    ISSUE = "ISSUE"
    TEST_CASE = "TEST_CASE"


class BlockerRef(BaseModel):
    """An unfinished issue standing in the way of one of mine.

    Enough to understand the hold-up and click through to it — no more of the
    blocking issue than the row shows.
    """

    id: int
    key: str
    title: str
    status: Status


class WorkItem(BaseModel):
    """One thing assigned to me, whatever it came from.

    `id` is unique across sources ("issue:12"); `type` plus `source_id` is what
    the client navigates by. Fields that only apply to one source are optional
    rather than faked for the other.
    """

    id: str
    type: WorkItemType
    source_id: int
    title: str
    # "DEV-42" for an issue; test cases have no key of their own.
    reference: str | None = None

    # Issue-only.
    status: Status | None = None
    priority: Priority | None = None
    issue_type: IssueType | None = None

    due_date: date | None = None
    sprint_id: int | None = None
    sprint_name: str | None = None

    # Test-case-only: the outcome of its most recent run, if it has ever run.
    last_result: TestResult | None = None
    last_run_at: datetime | None = None

    # Derived, not stored.
    overdue: bool = False
    blocked: bool = False
    blocked_by: list[BlockerRef] = Field(default_factory=list)


class SprintContext(BaseModel):
    """The active sprint, seen through the caller's own work.

    Counts are of *my* issues in it, not the whole sprint — this is My Work,
    not a second sprint dashboard.
    """

    id: int
    name: str
    start_date: date | None
    end_date: date | None
    state: SprintState
    assigned_count: int
    assigned_done: int


class UpcomingMeeting(BaseModel):
    """A meeting the caller is organizing or listed on. Compact on purpose —
    the Meetings page is where meetings are managed."""

    id: int
    title: str
    scheduled_at: datetime
    duration_minutes: int | None


class MyWorkResponse(BaseModel):
    items: list[WorkItem]
    sprint: SprintContext | None = None
    upcoming_meetings: list[UpcomingMeeting] = Field(default_factory=list)
