"""Request/response shapes for authentication (FR-1).

Pydantic validates incoming JSON against these classes before our code
runs — invalid input never reaches the service layer (422 is automatic).
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)  # FR-1.1; 72 = bcrypt max


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    """Public view of a user — note: no password_hash, ever."""

    id: int
    name: str
    email: EmailStr
    created_at: datetime

    # allows building this directly from a SQLAlchemy User object
    model_config = ConfigDict(from_attributes=True)
