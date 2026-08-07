"""Request/response shapes for issues and activities (FR-3, FR-6.2)."""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.issue import IssueType, Priority, Severity, Status


class IssueCreate(BaseModel):
    type: IssueType
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="")
    priority: Priority = Priority.MEDIUM
    assignee_id: int | None = None
    component_id: int | None = None
    deadline: date | None = None
    sprint_id: int | None = None

    # Bug-only fields
    severity: Severity | None = None
    steps_to_reproduce: str | None = None

    @model_validator(mode="after")
    def validate_bug_fields(self):
        """BUGs must have severity; TASKs must not. (TC-ISS-02, TC-ISS-03)"""
        if self.type == IssueType.BUG and self.severity is None:
            raise ValueError("severity is required for bugs")
        if self.type == IssueType.TASK and self.severity is not None:
            raise ValueError("severity only applies to bugs, not tasks")
        return self


class IssueUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    status: Status | None = None
    priority: Priority | None = None
    severity: Severity | None = None
    steps_to_reproduce: str | None = None
    assignee_id: int | None = None
    component_id: int | None = None
    deadline: date | None = None
    sprint_id: int | None = None


class IssueResponse(BaseModel):
    id: int
    project_id: int
    sprint_id: int | None
    number: int
    key: str       # e.g. "DEV-42" — computed in service, added here
    type: IssueType
    title: str
    description: str
    status: Status
    priority: Priority
    severity: Severity | None
    steps_to_reproduce: str | None
    component_id: int | None
    assignee_id: int | None
    reporter_id: int
    deadline: date | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ActivityResponse(BaseModel):
    id: int
    issue_id: int
    actor_id: int
    action: str
    field: str | None
    old_value: str | None
    new_value: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
