"""Import every model here so Base.metadata knows about all tables."""

from app.models.calendar import CalendarEvent
from app.models.chat import ChatMessage
from app.models.dependency import IssueDependency
from app.models.issue import Activity, Issue, IssueType, Priority, Severity, SprintState, Status
from app.models.issue import Sprint
from app.models.meeting import Meeting, MeetingParticipant
from app.models.note import Note, NoteType
from app.models.notification import Comment, Notification, NotifType
from app.models.project import Component, Project, ProjectMember, Role
from app.models.testing import TestCase, TestResult, TestRun
from app.models.user import User

__all__ = [
    "Activity", "CalendarEvent", "ChatMessage", "Comment", "Component", "Issue",
    "IssueDependency",
    "IssueType",
    "Meeting", "MeetingParticipant", "Note", "NoteType", "Notification",
    "NotifType", "Priority", "Project",
    "ProjectMember",
    "Role", "Severity", "Sprint", "SprintState", "Status",
    "TestCase", "TestResult", "TestRun", "User",
]
