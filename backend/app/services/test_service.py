"""Test case and test run business rules (FR-9).

Authorization follows the existing project conventions: any project member may
create test cases and record runs (the SRS role table grants Testers exactly
that, and Admins/Developers are not less capable), deleting is Admin-only like
issue deletion, non-members get 404 rather than 403, and an archived project
rejects every write.
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.issue import IssueType, Severity
from app.models.project import Role
from app.models.testing import TestCase, TestResult, TestRun
from app.models.user import User
from app.repositories import issue_repo, project_repo, test_repo
from app.schemas.issue import IssueCreate
from app.schemas.testing import (
    BugFromRunRequest,
    TestCaseCreate,
    TestCaseUpdate,
    TestRunCreate,
)
from app.services import issue_service


# ---------- helpers ----------


def _get_project_or_404(db: Session, project_id: int, caller: User):
    project = project_repo.get_by_id(db, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    if project_repo.get_member(db, project_id, caller.id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return project


def _require_not_archived(project) -> None:
    if project.archived:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Project is archived")


def _get_case_or_404(db: Session, case_id: int, caller: User) -> tuple[TestCase, object]:
    case = test_repo.get_case(db, case_id)
    if case is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Test case not found")
    project = _get_project_or_404(db, case.project_id, caller)
    return case, project


def _validate_issue_link(db: Session, project_id: int, issue_id: int | None) -> None:
    """A test case may only reference a live issue of its own project."""
    if issue_id is None:
        return
    issue = issue_repo.get_by_id(db, issue_id)
    if issue is None or issue.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Issue not found")


# ---------- test cases ----------


def list_cases(db: Session, project_id: int, caller: User, issue_id: int | None = None):
    _get_project_or_404(db, project_id, caller)
    return test_repo.list_cases(db, project_id, issue_id)


def get_case(db: Session, case_id: int, caller: User) -> TestCase:
    case, _ = _get_case_or_404(db, case_id, caller)
    return case


def create_case(
    db: Session, project_id: int, data: TestCaseCreate, caller: User
) -> TestCase:
    project = _get_project_or_404(db, project_id, caller)
    _require_not_archived(project)
    _validate_issue_link(db, project_id, data.issue_id)
    return test_repo.create_case(db, project_id, caller.id, **data.model_dump())


def update_case(db: Session, case_id: int, data: TestCaseUpdate, caller: User) -> TestCase:
    case, project = _get_case_or_404(db, case_id, caller)
    _require_not_archived(project)

    changes = data.model_dump(exclude_unset=True)
    if not changes:
        return case
    if "issue_id" in changes:
        _validate_issue_link(db, case.project_id, changes["issue_id"])
    return test_repo.update_case(db, case, **changes)


def delete_case(db: Session, case_id: int, caller: User) -> None:
    """Admin-only, mirroring issue deletion."""
    case, project = _get_case_or_404(db, case_id, caller)
    _require_not_archived(project)
    member = project_repo.get_member(db, case.project_id, caller.id)
    if member is None or member.role != Role.ADMIN:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Admin role required to delete test cases"
        )
    test_repo.delete_case(db, case)


# ---------- test runs ----------


def list_runs(db: Session, case_id: int, caller: User) -> list[TestRun]:
    _get_case_or_404(db, case_id, caller)
    return test_repo.list_runs(db, case_id)


def record_run(db: Session, case_id: int, data: TestRunCreate, caller: User) -> TestRun:
    """Append one execution. Runs are never edited — a re-test is a new run."""
    case, project = _get_case_or_404(db, case_id, caller)
    _require_not_archived(project)
    return test_repo.create_run(db, case.id, caller.id, **data.model_dump())


def create_bug_from_run(
    db: Session, run_id: int, data: BugFromRunRequest, caller: User
) -> dict:
    """One-click bug from a failed run (FR-9.2).

    The bug is created through issue_service.create_issue, so it picks up the
    project's sequential key, the archived guard, activity logging and the
    assignee notification exactly like any hand-written bug. Nothing about
    issue creation is duplicated here — this only builds the payload.

    The description is pre-filled from the test case (TC-TCM-01 requires the
    title and steps to carry over) and the run's notes.
    """
    run = test_repo.get_run(db, run_id)
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Test run not found")

    case, project = _get_case_or_404(db, run.test_case_id, caller)
    _require_not_archived(project)

    if run.result != TestResult.FAIL:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Only a failed run can raise a bug"
        )
    if run.issue_id is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "This run already has a bug raised from it"
        )

    sections = [f"Raised from a failed run of test case #{case.id}: {case.title}"]
    if case.preconditions:
        sections.append(f"Preconditions\n{case.preconditions}")
    if case.expected_result:
        sections.append(f"Expected result\n{case.expected_result}")
    if run.notes:
        sections.append(f"Run notes\n{run.notes}")

    payload = IssueCreate(
        type=IssueType.BUG,
        title=data.title or f"Test failure: {case.title}",
        description="\n\n".join(sections),
        # Bugs must carry a severity; MAJOR is the neutral default the caller
        # can override in the same request.
        severity=Severity(data.severity) if data.severity else Severity.MAJOR,
        steps_to_reproduce=case.steps or None,
        priority=data.priority or "MEDIUM",
        assignee_id=data.assignee_id,
        component_id=data.component_id,
    )

    issue = issue_service.create_issue(db, case.project_id, payload, caller.id)
    test_repo.link_bug(db, run, issue.id)

    return {"run": test_repo.get_run(db, run_id), "issue": issue}
