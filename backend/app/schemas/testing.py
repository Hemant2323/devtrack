"""Request/response shapes for test cases and runs (FR-9)."""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.testing import TestResult


# ---------- test cases ----------


class TestCaseCreate(BaseModel):
    """Exactly the fields FR-9.1 names, plus the optional issue link."""

    title: str = Field(min_length=1, max_length=200)
    preconditions: str = Field(default="", max_length=5000)
    steps: str = Field(default="", max_length=10000)
    expected_result: str = Field(default="", max_length=5000)
    issue_id: int | None = None
    deadline: date | None = None


class TestCaseUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    preconditions: str | None = Field(None, max_length=5000)
    steps: str | None = Field(None, max_length=10000)
    expected_result: str | None = Field(None, max_length=5000)
    issue_id: int | None = None
    deadline: date | None = None


class TestCaseResponse(BaseModel):
    id: int
    project_id: int
    issue_id: int | None
    title: str
    preconditions: str
    steps: str
    expected_result: str
    deadline: date | None
    created_by: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------- test runs ----------


class TestRunCreate(BaseModel):
    result: TestResult
    notes: str = Field(default="", max_length=10000)


class TestRunResponse(BaseModel):
    id: int
    test_case_id: int
    result: TestResult
    notes: str
    issue_id: int | None      # the bug raised from this run, if any
    executed_by: int
    executed_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BugFromRunRequest(BaseModel):
    """Overrides for the one-click bug (FR-9.2).

    Everything is optional: the point of the shortcut is that the title,
    description and steps are pre-filled from the test case. Severity defaults
    to MAJOR because the issue schema requires a severity on every bug.
    """

    title: str | None = Field(None, min_length=1, max_length=200)
    severity: str | None = None
    priority: str | None = None
    assignee_id: int | None = None
    component_id: int | None = None
