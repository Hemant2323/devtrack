"""Import every model here so that Base.metadata (used by Alembic
autogenerate and by tests' create_all) knows about all tables."""

from app.models.project import Component, Project, ProjectMember, Role
from app.models.user import User

__all__ = ["Component", "Project", "ProjectMember", "Role", "User"]
