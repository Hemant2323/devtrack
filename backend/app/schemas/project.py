"""Request/response shapes for projects, membership, and components (FR-2)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.project import Role


# ---------- projects ----------


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    key: str = Field(min_length=2, max_length=10, pattern=r"^[A-Z0-9]+$")
    description: str = Field(default="", max_length=1000)


class ProjectUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = None
    archived: bool | None = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    key: str
    description: str
    archived: bool
    issue_counter: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------- membership ----------


class MemberAdd(BaseModel):
    email: str
    role: Role = Role.DEVELOPER


class MemberUpdate(BaseModel):
    role: Role


class MemberResponse(BaseModel):
    id: int
    user_id: int
    role: Role
    joined_at: datetime
    name: str   # denormalised from user
    email: str

    model_config = ConfigDict(from_attributes=True)


# ---------- components ----------


class ComponentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    default_assignee_id: int | None = None


class ComponentResponse(BaseModel):
    id: int
    project_id: int
    name: str
    default_assignee_id: int | None

    model_config = ConfigDict(from_attributes=True)
