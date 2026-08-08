# AI Context — DevTrack

> This file is for AI assistants resuming work on this project.
> Read this + `docs/PROJECT_STATUS.md` before making any changes.
> Last updated: 2026-08-08 after Sprint 2 complete.

---

## What This Project Is

DevTrack is a full-stack software project management and bug-tracking tool (Jira + GitHub Issues hybrid) built as a university placement project. The headline feature is AI-assisted bug triage via the Anthropic Claude API (Sprint 6 — not yet built).

**Stack:** FastAPI backend · React (Vite) frontend · SQLite dev DB · JWT auth · SQLAlchemy 2 · Alembic migrations

---

## Architecture Conventions — Follow These Exactly

1. **Layer discipline:** `router → service → repository`. Routers are thin (parse input, call service, return schema). Business logic and permission checks live in services. All ORM queries live in repositories.
2. **Error codes:** 401 unauthenticated · 403 wrong role · **404 for resources outside the caller's projects** (existence hiding — never reveal a resource exists to a non-member) · 409 conflicts.
3. **Every protected endpoint** uses `Depends(get_current_user)` from `app/core/deps.py`.
4. **New models** must be imported in `app/models/__init__.py` (Alembic autogenerate and the test `create_all` both depend on it).
5. **Schema changes only via Alembic:** `alembic revision --autogenerate -m "..."` then `alembic upgrade head`.
6. **Notifications** are fired by calling `notification_service.notify(db, user_id, type_, message, issue_id)` — never call `notification_repo` directly from a router.
7. **Activity log** is append-only. Call `activity_repo.log(db, issue_id, actor_id, action, ...)` inside the same transaction as the mutation (before `db.commit()`).
8. **Frontend:** all API calls go through `src/api/client.js`. JWT header attached automatically. New pages go in `src/pages/`; add their `<Route>` in `src/main.jsx`; wrap with `<ProtectedRoute>` for auth-required pages.

---

## Project Structure

```
devtrack/
├── backend/
│   ├── app/
│   │   ├── core/           # security.py (JWT/bcrypt), deps.py (get_current_user), config.py
│   │   ├── models/         # SQLAlchemy ORM — user, project, issue, notification
│   │   │   └── __init__.py # IMPORT EVERY MODEL HERE
│   │   ├── schemas/        # Pydantic request/response shapes
│   │   ├── repositories/   # ORM queries only
│   │   ├── services/       # business rules, permission checks, tx management
│   │   ├── routers/        # HTTP layer — thin, calls services
│   │   ├── database.py     # engine, get_db, Base
│   │   └── main.py         # FastAPI app, CORS, mount all routers here
│   ├── alembic/            # migrations
│   ├── tests/
│   │   ├── conftest.py     # in-memory SQLite per test, client fixture
│   │   ├── test_auth.py
│   │   ├── test_projects.py
│   │   ├── test_issues.py
│   │   └── test_board_comments_notifs.py
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── api/client.js   # central fetch wrapper + token helpers
│       ├── auth/           # AuthContext.jsx, ProtectedRoute.jsx
│       ├── pages/          # LoginPage, SignupPage, ProjectsPage
│       └── main.jsx        # React Router routes
└── docs/
    ├── 01-SRS.md           # requirements (11 FRs + 10 NFRs)
    ├── 03-Architecture.md  # layered design, DB schema, API surface
    ├── 06-Progress-Report.md
    ├── progress/HANDOFF.md # per-sprint resume guide
    ├── PROJECT_STATUS.md   # ← this sprint's status (living doc)
    └── AI_CONTEXT.md       # ← this file
```

---

## Current Database State

Dev DB: `backend/devtrack.db` (SQLite, gitignored). Recreate with `alembic upgrade head`.

Applied migrations in order:
- `76f3a406ccd0` — users
- `25468ae6d375` — projects, project_members, components  
- `e1f10b916bf6` — issues, sprints, activities
- `5018ea08b3a9` — comments, notifications

---

## What Is and Isn't Built

### ✅ Done (backend)
- FR-1 Auth: signup, login, JWT access+refresh, `/auth/me`
- FR-2 Projects: CRUD, RBAC, membership, archive guard, components
- FR-3 Issues: CRUD, soft delete, sequential keys (DEV-42), type/severity validation, search+filter
- FR-4 Kanban board: `GET /projects/{id}/board` grouped by status
- FR-6.1 Comments: full CRUD, author-only edit, author+Admin delete, activity logged
- FR-6.2 Activity log: append-only, atomic with every mutation
- FR-8 Notifications: ASSIGNED, STATUS_CHANGE, MENTION; mark-read endpoint

### ✅ Done (frontend)
- Login, Signup, ProjectsPage (list + create), AuthContext, ProtectedRoute

### ❌ Not yet built
- FR-5 Sprint endpoints (model/table exists, no service/router)
- FR-9 Test case management
- FR-10 Dashboard
- FR-11 AI triage (Claude API)
- Frontend: board page, issue detail, comments UI, notification bell, sprint selector

---

## Commands

```bash
# backend (from backend/)
.venv/Scripts/pip install -r requirements.txt
.venv/Scripts/python -m alembic upgrade head
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
.venv/Scripts/python -m pytest tests/ -q    # 46 tests

# frontend (from frontend/)
npm install
npm run dev      # http://localhost:5173
npm run build
```

## Environment Variables (`backend/.env.example`)
- `DATABASE_URL` — SQLite path or PostgreSQL URL
- `JWT_SECRET` — random secret for signing tokens
- `CORS_ORIGINS` — comma-separated allowed origins
- `ANTHROPIC_API_KEY` — needed only for Sprint 6 AI triage

---

## Test Patterns

New tests follow the helpers in `test_board_comments_notifs.py`:

```python
def _user(client, email, name="User", pw="secret123"):
    # signup + login + get id, return (auth_headers, user_id)

def _project(client, hdrs, key):
    # POST /projects, return project dict

def _issue(client, hdrs, pid, title="Issue", type_="TASK", **kw):
    # POST /projects/{pid}/issues, return issue dict
```

The `client` fixture (conftest.py) spins up a fresh in-memory SQLite DB per test — no shared state between tests.

---

## Port Note

`frontend/src/api/client.js` currently has `BASE_URL = http://localhost:8001`. The backend runs on 8000 by default. Align these before running the full stack locally.
