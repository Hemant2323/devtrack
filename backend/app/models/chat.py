"""Project chat model.

Structurally this is Comment scoped to a project instead of an issue, and it
follows that model's conventions deliberately: same body/created_at/edited_at
shape, same author relationship, same "edited_at is non-null only after an
edit" rule.

One table carries both conversation kinds. `recipient_id` is NULL for a team
message and names the other participant for a direct message, so a DM is a
message that happens to be addressed to someone — not a second subsystem.
Every existing row predates DMs and is already correct as NULL, which is why
this shape needed no data migration.

The consequence is that *every* team-chat read must say `recipient_id IS NULL`
explicitly; a query that forgets it would show private messages in the team
transcript. That predicate lives in exactly one place (chat_repo).
"""

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    __table_args__ = (
        # Both reads start here: team chat filters (project_id, NULL) and a DM
        # thread filters (project_id, non-NULL) before testing the pair.
        Index("ix_chat_messages_project_recipient", "project_id", "recipient_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    # NULL = team chat. Non-null = a direct message to that project member.
    recipient_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    # Non-null only after an edit
    edited_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Two paths to users now, so each relationship names its own column.
    author = relationship("User", foreign_keys=[author_id])
    recipient = relationship("User", foreign_keys=[recipient_id])
