"""My Work business rules (Sprint 6).

A convenience view, not a system. Everything below is derived per request from
issues, test cases, sprints, meetings and the existing dependency graph; there
is no My Work table, no second assignment mechanism, and nothing here writes.

The caller is always the authenticated user. This service takes a `caller_id`
and never a target user id, so there is no parameter through which one person
could ask for another's work — the router passes `me.id` and nothing else.

Authorization is the existing project convention: any member reads their own,
a non-member gets 404 (existence hiding). An archived project stays readable,
matching every other project read; My Work introduces no write of any kind, so
it has no archived-write rule to apply.

One known gap, deliberately not papered over: TestCase has no assignee column —
only `created_by` — so "my test cases" means the ones this user wrote. Adding an
assignee would be a new assignment field on an existing entity, which this
phase explicitly rules out.
"""

from datetime import date, datetime, timezone

from fastapi import HTTPException, status as http_status
from sqlalchemy.orm import Session

from app.models.issue import Status
from app.repositories import (
    dependency_repo,
    my_work_repo,
    project_repo,
    sprint_repo,
)
from app.schemas.my_work import (
    BlockerRef,
    MyWorkResponse,
    SprintContext,
    UpcomingMeeting,
    WorkItem,
    WorkItemType,
)

# Enough to answer "what is next" without becoming a meetings page.
MAX_UPCOMING_MEETINGS = 5

# Actionable first, finished last. Deliberately a fixed ladder rather than a
# score: a person should be able to predict why a row is where it is.
RANK_OVERDUE = 0
RANK_BLOCKED = 1
RANK_IN_PROGRESS = 2
RANK_TESTING = 3
RANK_ACTIVE = 4
RANK_DONE = 5


def _get_project_or_404(db: Session, project_id: int, caller_id: int):
    project = project_repo.get_by_id(db, project_id)
    if project is None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Project not found")
    if project_repo.get_member(db, project_id, caller_id) is None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Project not found")
    return project


def _rank(item: WorkItem) -> int:
    """Which band a row sits in. Overdue and blocked outrank status, because
    they are the reason someone opened this page."""
    if item.overdue:
        return RANK_OVERDUE
    if item.blocked:
        return RANK_BLOCKED
    if item.status == Status.DONE:
        return RANK_DONE
    if item.status == Status.IN_PROGRESS:
        return RANK_IN_PROGRESS
    if item.status == Status.TESTING:
        return RANK_TESTING
    return RANK_ACTIVE


def _sort_key(item: WorkItem):
    """Within a band, soonest first — and anything undated after everything
    dated, since a row with no deadline is not competing for the same urgency."""
    return (
        _rank(item),
        item.due_date is None,
        item.due_date or date.max,
        item.type.value,
        item.source_id,
    )


def _blockers_by_issue(db: Session, project_id: int, issue_ids: set[int], project_key: str):
    """Unfinished blockers, keyed by the issue they hold up.

    Reuses the project-wide dependency scan the board already relies on: one
    query for every edge in the project, filtered here to the caller's issues.
    That is what keeps this off a per-issue request.
    """
    blockers: dict[int, list[BlockerRef]] = {}
    for dependency, blocking in dependency_repo.list_for_project(db, project_id):
        if dependency.blocked_issue_id not in issue_ids:
            continue
        # A blocker that is done is no longer blocking — the same rule the
        # board's indicator uses.
        if blocking.status == Status.DONE:
            continue
        blockers.setdefault(dependency.blocked_issue_id, []).append(
            BlockerRef(
                id=blocking.id,
                key=f"{project_key}-{blocking.number}",
                title=blocking.title,
                status=blocking.status,
            )
        )
    return blockers


def get_my_work(
    db: Session, project_id: int, caller_id: int, today: date | None = None
) -> MyWorkResponse:
    """Everything in this project currently on the caller's plate."""
    project = _get_project_or_404(db, project_id, caller_id)
    today = today or date.today()

    issues = my_work_repo.issues_for_user(db, project_id, caller_id)
    cases = my_work_repo.test_cases_for_user(db, project_id, caller_id)

    active_sprint = sprint_repo.get_active(db, project_id)
    sprint_names = {active_sprint.id: active_sprint.name} if active_sprint else {}
    # Any other sprint an assigned issue belongs to, so the row can name it
    # without a lookup per issue.
    for sprint in sprint_repo.list_for_project(db, project_id):
        sprint_names.setdefault(sprint.id, sprint.name)

    blockers = _blockers_by_issue(
        db, project_id, {issue.id for issue in issues}, project.key
    )

    items: list[WorkItem] = []

    for issue in issues:
        held_up = blockers.get(issue.id, [])
        done = issue.status == Status.DONE
        items.append(
            WorkItem(
                id=f"issue:{issue.id}",
                type=WorkItemType.ISSUE,
                source_id=issue.id,
                title=issue.title,
                reference=f"{project.key}-{issue.number}",
                status=issue.status,
                priority=issue.priority,
                issue_type=issue.type,
                due_date=issue.deadline,
                sprint_id=issue.sprint_id,
                sprint_name=sprint_names.get(issue.sprint_id),
                # Finished work is never overdue, however long ago it was due.
                overdue=bool(issue.deadline and issue.deadline < today and not done),
                # Nor is it still blocked — the dependency may stand, but it is
                # no longer holding anyone up.
                blocked=bool(held_up) and not done,
                blocked_by=[] if done else held_up,
            )
        )

    latest = {
        run.test_case_id: run for run in my_work_repo.latest_runs(db, [c.id for c in cases])
    }
    for case in cases:
        run = latest.get(case.id)
        items.append(
            WorkItem(
                id=f"test_case:{case.id}",
                type=WorkItemType.TEST_CASE,
                source_id=case.id,
                title=case.title,
                due_date=case.deadline,
                # A test case has no status of its own, so it can only be
                # overdue on its date.
                overdue=bool(case.deadline and case.deadline < today),
                last_result=run.result if run else None,
                last_run_at=run.executed_at if run else None,
            )
        )

    items.sort(key=_sort_key)

    sprint_context = None
    if active_sprint:
        mine = [item for item in items if item.sprint_id == active_sprint.id]
        sprint_context = SprintContext(
            id=active_sprint.id,
            name=active_sprint.name,
            start_date=active_sprint.start_date,
            end_date=active_sprint.end_date,
            state=active_sprint.state,
            assigned_count=len(mine),
            assigned_done=sum(1 for item in mine if item.status == Status.DONE),
        )

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    meetings = my_work_repo.upcoming_meetings_for_user(
        db, project_id, caller_id, now, MAX_UPCOMING_MEETINGS
    )

    return MyWorkResponse(
        items=items,
        sprint=sprint_context,
        upcoming_meetings=[
            UpcomingMeeting(
                id=meeting.id,
                title=meeting.title,
                scheduled_at=meeting.scheduled_at,
                duration_minutes=meeting.duration_minutes,
            )
            for meeting in meetings
        ],
    )
