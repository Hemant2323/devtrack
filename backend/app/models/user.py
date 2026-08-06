"""User table (SRS §2.3, docs/03-Architecture.md §2)."""

from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    # unique + indexed: email is the login identifier (FR-1.2)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    # bcrypt output is 60 chars; never store the plain password (NFR-3)
    password_hash: Mapped[str] = mapped_column(String(60))
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
