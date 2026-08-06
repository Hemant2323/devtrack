# Milestone 03 — Authentication (FR-1)

**Commit:** `57cc7d8` · **Date:** 6 Aug 2026

## What & why
Signup, login, and token refresh. Every later feature needs to know *who* is calling — this milestone provides that identity layer.

## How it works (simple)
1. **Signup** stores the user with a **bcrypt hash** of the password (one-way scramble — a stolen DB reveals no passwords).
2. **Login** verifies the password against the hash and returns two **JWTs**: an *access token* (30 min — sent with every request as `Authorization: Bearer <token>`) and a *refresh token* (7 days — exchanged at `/auth/refresh` for fresh tokens, so users aren't logged out every 30 minutes).
3. A JWT is a signed JSON payload (`sub` = user id, `type` = access/refresh, `exp` = expiry). The server verifies the signature with its `JWT_SECRET` — no session storage needed.
4. Protected endpoints declare `Depends(get_current_user)`, which decodes the token and loads the user, or returns 401.

## Important files (all under `backend/`)
| File | Role |
|---|---|
| `app/core/security.py` | bcrypt hash/verify · JWT create/decode |
| `app/core/deps.py` | `get_current_user` dependency (the "login required" gate) |
| `app/models/user.py` | `users` table |
| `app/schemas/auth.py` | request/response validation (password ≥ 8 chars, valid email) |
| `app/repositories/user_repo.py` | user queries |
| `app/services/auth_service.py` | rules: duplicate email → 409, bad login → generic 401 |
| `app/routers/auth.py` | endpoints |
| `alembic/` | migration env + `76f3a406ccd0` (creates users table) |
| `tests/conftest.py`, `tests/test_auth.py` | fixtures + 13 tests |

## API endpoints added
- `POST /auth/signup` → 201 user (409 duplicate email, 422 invalid input)
- `POST /auth/login` → 200 tokens (401 generic on any bad credential)
- `POST /auth/refresh` → 200 new tokens (401 invalid/expired/wrong-type token)
- `GET /auth/me` → 200 current user (401 without valid access token)

## Database changes
`users(id, name, email unique+indexed, password_hash, created_at)` via Alembic migration `76f3a406ccd0`.

## Key concepts (beginner)
- **bcrypt**: slow on purpose (2^12 rounds) so brute-forcing hashes is impractical.
- **JWT**: signed, not encrypted — anyone can read the payload, but only the server can create valid signatures. Never put secrets in a JWT.
- **User enumeration guard**: wrong email and wrong password return the *same* 401 message.
- **Dependency injection**: FastAPI `Depends()` runs shared code (DB session, auth check) before handlers.

## Tests performed
`pytest`: **13/13 passed** — signup (success/duplicate/weak password/bad email), login (success/wrong password/unknown email), /auth/me (valid/missing/garbage/expired token), refresh (success/access-token-rejected). Tests run on in-memory SQLite via `get_db` override.
Manual: live signup→login→me flow verified with curl against uvicorn; 401 without token confirmed.

## Problems & fixes
- One test initially failed: the test fixture merged the plaintext password into its return dict, so "no password in response" checked the wrong object. Fixed the test (API was correct).

## Decisions
- **PyJWT + bcrypt directly** (not passlib/python-jose — both unmaintained).
- Refresh tokens are stateless (not stored in DB) — logout is client-side token deletion. Documented trade-off: no server-side revocation in v1.0.
- `/auth/me` added beyond bare FR-1 — needed by the frontend to restore sessions.

## State after milestone
Backend auth fully working + tested. No frontend for it yet.

## Next step (as of this milestone)
FR-2: Project CRUD, membership + roles (RBAC), components.
