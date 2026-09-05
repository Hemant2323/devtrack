"""Request/response shapes for issue dependencies (Sprint 6)."""

import enum
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.issue import IssueType, Status


class DependencyDirection(str, enum.Enum):
    """Which way the new edge points, relative to the issue in the URL."""

    BLOCKS = "BLOCKS"          # this issue blocks the other one
    BLOCKED_BY = "BLOCKED_BY"  # this issue is blocked by the other one


class DependencyCreate(BaseModel):
    """The other end of the link, plus which way it points.

    One endpoint with a direction rather than two mirrored endpoints: the UI
    asks the same question ("which issue, and which way round?") either way.
    """

    issue_id: int
    direction: DependencyDirection


class DependencyIssueRef(BaseModel):
    """Just enough of the other issue to render a row and link to it —
    "BUG-18  Fix authentication", with status so a resolved blocker reads
    differently. No description, no assignee, nothing the row does not show."""

    id: int
    key: str
    title: str
    type: IssueType
    status: Status

    model_config = ConfigDict(from_attributes=True)


class DependencyLink(BaseModel):
    """One row of either list. `id` is the dependency itself, which is what
    removal addresses; `issue` is always the *other* issue."""

    id: int
    issue: DependencyIssueRef
    created_at: datetime


class IssueDependenciesResponse(BaseModel):
    """Both directions in one response, already separated the way the panel
    displays them, so the client does no filtering."""

    blocked_by: list[DependencyLink]
    blocks: list[DependencyLink]


class ProjectDependencyEdge(BaseModel):
    """One edge for the whole project, carrying the blocker's status.

    This is what lets the board mark blocked cards from a single request:
    an issue is blocked when some edge points at it whose blocker is not yet
    DONE. Ids only — the board already holds the issues themselves.
    """

    id: int
    blocking_issue_id: int
    blocked_issue_id: int
    blocking_status: Status
