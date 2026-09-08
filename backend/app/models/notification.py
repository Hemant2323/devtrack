"""Comment and Notification models (FR-6.1, FR-8)."""

import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, utcnow


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    issue_id: Mapped[int] = mapped_column(ForeignKey("issues.id"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    # Non-null only after an edit
    edited_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    author = relationship("User")


class NotifType(str, enum.Enum):
    ASSIGNED = "ASSIGNED"
    STATUS_CHANGE = "STATUS_CHANGE"
    MENTION = "MENTION"
    DEADLINE = "DEADLINE"


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    type: Mapped[NotifType] = mapped_column(Enum(NotifType))
    message: Mapped[str] = mapped_column(String(255))
    issue_id: Mapped[int | None] = mapped_column(ForeignKey("issues.id"), nullable=True)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
