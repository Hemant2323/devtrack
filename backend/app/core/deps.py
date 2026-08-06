"""Shared FastAPI dependencies.

`get_current_user` is how any endpoint becomes protected:

    @router.get("/something")
    def handler(user: User = Depends(get_current_user)): ...

FastAPI runs it before the handler; if the token is missing/invalid it
responds 401 and the handler never executes (FR-1.4).
"""

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core import security
from app.database import get_db
from app.models.user import User
from app.repositories import user_repo

# Extracts "Authorization: Bearer <token>" from the request headers.
# auto_error=False lets us return our own 401 message when it's absent.
_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        "Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized
    try:
        user_id = security.decode_token(credentials.credentials, expected_type="access")
    except jwt.InvalidTokenError:
        raise unauthorized
    user = user_repo.get_by_id(db, user_id)
    if user is None:
        raise unauthorized
    return user
