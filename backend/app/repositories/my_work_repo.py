"""Queries behind My Work.

Every function here is a read over a table someone else owns. My Work has no
table of its own, and nothing below writes.

The whole page is a fixed number of project-scoped queries — one per source,
plus one grouped lookup for test-run results and one for meetings — so a person
with fifty assigned issues costs the same as a person with five. In particular
there is no per-issue dependency query: blockers arrive through the existing
project-wide dependency scan.
"""

from datetime import datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.issue import Issue
from app.models.meeting import Meeting, MeetingParticipant
from app.models.testing import TestCase, TestRun


def issues_for_user(db: Session, project_id: int, user_id: int) -> list[Issue]:
    """Live issues assigned to this user."""
    return list(
        db.scalars(
            select(Issue)
            .where(
                Issue.project_id == project_id,
                Issue.assignee_id == user_id,
                Issue.deleted_at.is_(None),
            )
            .order_by(Issue.id.asc())
        )
    )


def test_cases_for_user(db: Session, project_id: int, user_id: int) -> list[TestCase]:
    """Test cases this user owns.

    `created_by` is the only person-shaped field TestCase has — there is no
    assignee on it, so authorship is what "mine" can mean here. See the service
    docstring; this is a reported limitation, not an oversight.
    """
    return list(
        db.scalars(
            select(TestCase)
            .where(TestCase.project_id == project_id, TestCase.created_by == user_id)
            .order_by(TestCase.id.asc())
        )
    )


def latest_runs(db: Session, case_ids: list[int]) -> list[TestRun]:
    """The most recent run of each of the given cases.

    Two queries for the whole page rather than one per case: the newest run id
    per case is found by grouping, and those rows are then loaded.
    """
    if not case_ids:
        return []
    newest = (
        select(func.max(TestRun.id))
        .where(TestRun.test_case_id.in_(case_ids))
        .group_by(TestRun.test_case_id)
    )
    return list(db.scalars(select(TestRun).where(TestRun.id.in_(newest))))


def upcoming_meetings_for_user(
    db: Session, project_id: int, user_id: int, now: datetime, limit: int
) -> list[Meeting]:
    """The caller's next few meetings: ones they organize, and ones they are
    listed on. One query — the participant side is an EXISTS rather than a
    join, so a meeting is never returned twice."""
    listed = (
        select(MeetingParticipant.id)
        .where(
            MeetingParticipant.meeting_id == Meeting.id,
            MeetingParticipant.user_id == user_id,
        )
        .exists()
    )
    return list(
        db.scalars(
            select(Meeting)
            .where(
                Meeting.project_id == project_id,
                Meeting.scheduled_at >= now,
                or_(Meeting.organizer_id == user_id, listed),
            )
            .order_by(Meeting.scheduled_at.asc(), Meeting.id.asc())
            .limit(limit)
        )
    )
