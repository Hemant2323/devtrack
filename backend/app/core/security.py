"""Password hashing and JWT helpers (FR-1).

Passwords: bcrypt — a deliberately slow, salted, one-way hash.
We can check "does this password match the hash?" but never recover
the password itself, so a stolen database doesn't leak passwords.

Tokens: JWT — a JSON payload signed with our secret. The server can
verify a token wasn't tampered with, without storing sessions.
Payload: sub (user id), type ("access" | "refresh"), exp (expiry).
"""

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import settings

# ---------- passwords ----------


def hash_password(plain: str) -> str:
    # gensalt(12) = 2^12 hashing rounds — slow enough to resist
    # brute force, fast enough for a login request (NFR-3).
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(12)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ---------- tokens ----------


def _create_token(user_id: int, token_type: str, lifetime: timedelta) -> str:
    payload = {
        "sub": str(user_id),  # "subject" — whom the token is about
        "type": token_type,   # prevents a refresh token being used as access
        "exp": datetime.now(timezone.utc) + lifetime,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: int) -> str:
    return _create_token(
        user_id, "access", timedelta(minutes=settings.access_token_minutes)
    )


def create_refresh_token(user_id: int) -> str:
    return _create_token(user_id, "refresh", timedelta(days=settings.refresh_token_days))


def decode_token(token: str, expected_type: str) -> int:
    """Return the user id inside a valid token.

    Raises jwt.InvalidTokenError (or a subclass, e.g. ExpiredSignatureError)
    if the token is expired, tampered with, or of the wrong type.
    """
    payload = jwt.decode(
        token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
    )
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError(f"expected a {expected_type} token")
    return int(payload["sub"])
