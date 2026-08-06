"""Authentication business rules (FR-1).

Raises HTTPException for business failures; the router stays thin.
"""

import jwt
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core import security
from app.models.user import User
from app.repositories import user_repo
from app.schemas.auth import LoginRequest, SignupRequest, TokenResponse


def signup(db: Session, data: SignupRequest) -> User:
    if user_repo.get_by_email(db, data.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    return user_repo.create(
        db,
        name=data.name,
        email=data.email,
        password_hash=security.hash_password(data.password),
    )


def login(db: Session, data: LoginRequest) -> TokenResponse:
    user = user_repo.get_by_email(db, data.email)
    # One generic message for both "no such user" and "wrong password" —
    # a specific message would let attackers discover which emails exist
    # (user enumeration, TC-AUTH-02).
    if user is None or not security.verify_password(data.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    return _issue_tokens(user.id)


def refresh(db: Session, refresh_token: str) -> TokenResponse:
    try:
        user_id = security.decode_token(refresh_token, expected_type="refresh")
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token")
    if user_repo.get_by_id(db, user_id) is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User no longer exists")
    return _issue_tokens(user_id)


def _issue_tokens(user_id: int) -> TokenResponse:
    return TokenResponse(
        access_token=security.create_access_token(user_id),
        refresh_token=security.create_refresh_token(user_id),
    )
