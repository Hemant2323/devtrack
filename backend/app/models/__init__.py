"""Import every model here so Base.metadata knows about all tables."""

from app.models.issue import Activity, Issue, IssueType, Priority, Severity, SprintState, Status
from app.models.project import Component, Project, ProjectMember, Role
from app.models.issue import Sprint
from app.models.user import User

__all__ = [
    "Activity", "Component", "Issue", "IssueType", "Priority",
    "Project", "ProjectMember", "Role", "Severity", "Sprint",
    "SprintState", "Status", "User",
]
