"""Import every model here so Base.metadata knows about all tables."""

from app.models.issue import Activity, Issue, IssueType, Priority, Severity, SprintState, Status
from app.models.issue import Sprint
from app.models.notification import Comment, Notification, NotifType
from app.models.project import Component, Project, ProjectMember, Role
from app.models.user import User

__all__ = [
    "Activity", "Comment", "Component", "Issue", "IssueType",
    "Notification", "NotifType", "Priority", "Project", "ProjectMember",
    "Role", "Severity", "Sprint", "SprintState", "Status", "User",
]
