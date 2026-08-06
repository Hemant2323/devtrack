# HANDOFF — resume DevTrack development here

> Read this + `docs/progress/README.md`, then the milestone reports.
> Architecture source of truth: `docs/03-Architecture.md`. Requirements: `docs/01-SRS.md`.

**Last updated:** 6 Aug 2026, after Milestone 03 (authentication).

## Where we are
- **Sprint 1** (of 6, see `docs/04-Project-Plan.md`), roughly halfway.
- ✅ **Fully working:** scaffolds (FastAPI + React, CORS, /health) · authentication FR-1 (signup/login/refresh/me, bcrypt, JWT, 13 passing tests)
- 🔄 **In progress:** nothing mid-edit — clean state at commit `57cc7d8`.
- ❌ **Not started (rest of Sprint 1):** FR-2 project CRUD + membership/roles/components (backend) · frontend auth pages + protected routes + project list · CI workflow (lint+test)
- 🚫 **Do not start:** Sprint 2+ features (issues, board, comments…).

## Architecture conventions (keep following these)
1. Layers: **router → service → repository**. Routers thin; business rules + permission checks in services; all ORM queries in repositories.
2. Every new model imported in `app/models/__init__.py` (Alembic + tests depend on it).
3. Schema changes only via Alembic: `alembic revision --autogenerate -m "..."` then `alembic upgrade head`.
4. Errors: raise `HTTPException` in services. 401 unauthenticated, 403 wrong role, **404 for resources outside caller's projects** (don't leak existence), 409 conflicts.
5. Tests: in-memory SQLite via `get_db` override (see `tests/conftest.py`); name tests after test-plan IDs where possible.
6. Frontend: all API calls through `src/api/client.js`; JWT header will be attached there.

## Database / migration state
- Dev DB: `backend/devtrack.db` (SQLite, gitignored). Migrations in `backend/alembic/versions/`.
- Applied: `76f3a406ccd0` — users table. `alembic upgrade head` recreates from scratch.

## Commands (run from `backend/` or `frontend/`)
```bash
# backend (Windows paths; venv already exists in backend/.venv)
.venv/Scripts/pip install -r requirements.txt
.venv/Scripts/python -m alembic upgrade head
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000   # API + docs at /docs
.venv/Scripts/python -m pytest tests/ -q

# frontend
npm install
npm run dev      # http://localhost:5173
npm run build
```

## Environment variables (names only — values in local .env, NEVER commit)
`DATABASE_URL`, `CORS_ORIGINS`, `JWT_SECRET` (see `backend/.env.example`; defaults exist for dev, JWT_SECRET must be overridden in production). Later sprints add `ANTHROPIC_API_KEY` (Sprint 5, AI triage).

## Git log (newest first)
- `57cc7d8` auth backend (FR-1) + tests
- `84c238a` progress report doc
- `ca082ba` scaffolds (FastAPI + React + health check)
- `e92b0de` planning docs

Local repo only — nothing pushed. **Never push without the owner's say-so.**

## Known issues
- None blocking. Noted trade-off: refresh tokens are stateless → no server-side logout/revocation (accepted for v1.0, see report 03).

## Exact next task
Build **FR-2 (backend)**: models `Project`, `ProjectMember` (role enum ADMIN/DEVELOPER/TESTER, unique project+user), `Component` → one Alembic migration → schemas → repos → `project_service` with RBAC (creator becomes Admin per FR-2.1; only Admin manages members/components; non-members get 404) → routers (`/projects`, members, components subroutes) → tests TC-PRJ-01..03 (archived-write check TC-PRJ-04 becomes meaningful with issues in Sprint 2; enforce archived read-only where applicable now). Then frontend auth + project list, then CI. Details: `docs/04-Project-Plan.md` Sprint 1.
