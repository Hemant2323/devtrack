"""Import every model here so that Base.metadata (used by Alembic
autogenerate and by tests' create_all) knows about all tables."""

from app.models.user import User

__all__ = ["User"]
