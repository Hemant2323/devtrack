"""Request/response shapes for sprints (FR-5)."""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.issue import SprintState


class SprintCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    goal: str = Field(default="", max_length=2000)
    start_date: date | None = None
    end_date: date | None = None

    @model_validator(mode="after")
    def validate_dates(self):
        """A sprint that ends before it starts is always a mistake."""
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must not be earlier than start_date")
        return self


class SprintUpdate(BaseModel):
    """Only the planning fields are editable. `state` moves through the
    lifecycle endpoints instead, so the one-active-sprint rule and the
    return-to-backlog behaviour can never be bypassed by a plain PATCH."""

    name: str | None = Field(None, min_length=1, max_length=100)
    goal: str | None = Field(None, max_length=2000)
    start_date: date | None = None
    end_date: date | None = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must not be earlier than start_date")
        return self


class SprintResponse(BaseModel):
    id: int
    project_id: int
    name: str
    goal: str
    start_date: date | None
    end_date: date | None
    state: SprintState
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SprintReport(BaseModel):
    """Completed vs planned, as required by FR-5.4.

    Produced at the moment of completion. It is not stored: once unfinished
    issues have been returned to the backlog the original planned scope can no
    longer be reconstructed from the database.
    """

    sprint: SprintResponse
    planned: int          # issues in the sprint when it was completed
    completed: int        # of those, the ones in DONE
    returned_to_backlog: int
    returned_issue_ids: list[int]
