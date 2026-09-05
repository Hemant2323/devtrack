"""Test case and test run endpoints (FR-9). Routers stay thin."""

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.issue import IssueResponse
from app.schemas.testing import (
    BugFromRunRequest,
    TestCaseCreate,
    TestCaseResponse,
    TestCaseUpdate,
    TestRunCreate,
    TestRunResponse,
)
from app.services import test_service

router = APIRouter(tags=["testing"])


class BugFromRunResponse(BaseModel):
    """The updated run plus the bug it raised, so the client needs no follow-up
    request to show either."""

    run: TestRunResponse
    issue: IssueResponse


# ---------- project-scoped: list + create ----------


@router.get("/projects/{project_id}/test-cases", response_model=list[TestCaseResponse])
def list_test_cases(
    project_id: int,
    issue_id: int | None = None,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    return test_service.list_cases(db, project_id, me, issue_id)


@router.post(
    "/projects/{project_id}/test-cases",
    response_model=TestCaseResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_test_case(
    project_id: int,
    data: TestCaseCreate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    return test_service.create_case(db, project_id, data, me)


# ---------- case-scoped ----------


@router.get("/test-cases/{case_id}", response_model=TestCaseResponse)
def get_test_case(
    case_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    return test_service.get_case(db, case_id, me)


@router.patch("/test-cases/{case_id}", response_model=TestCaseResponse)
def update_test_case(
    case_id: int,
    data: TestCaseUpdate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    return test_service.update_case(db, case_id, data, me)


@router.delete("/test-cases/{case_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_test_case(
    case_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    test_service.delete_case(db, case_id, me)


# ---------- runs ----------


@router.get("/test-cases/{case_id}/runs", response_model=list[TestRunResponse])
def list_test_runs(
    case_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    return test_service.list_runs(db, case_id, me)


@router.post(
    "/test-cases/{case_id}/runs",
    response_model=TestRunResponse,
    status_code=status.HTTP_201_CREATED,
)
def record_test_run(
    case_id: int,
    data: TestRunCreate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Record pass / fail / blocked with notes (FR-9.2)."""
    return test_service.record_run(db, case_id, data, me)


@router.post(
    "/test-runs/{run_id}/bug",
    response_model=BugFromRunResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_bug_from_run(
    run_id: int,
    data: BugFromRunRequest,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """One-click bug from a failed run, pre-filled from the test case (FR-9.2)."""
    return test_service.create_bug_from_run(db, run_id, data, me)
