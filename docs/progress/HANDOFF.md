# HANDOFF — resume DevTrack development here

> Read this + `docs/progress/README.md`, then the milestone reports.
> Architecture source of truth: `docs/03-Architecture.md`. Requirements: `docs/01-SRS.md`.

**Last updated:** 6 Aug 2026, after Milestone 05 — Sprint 1 complete.

## Where we are
- **Sprint 1 done.** All planned Sprint 1 work is committed and tested.
- ✅ **Working:** Scaffolds · Auth FR-1 (signup/login/refresh/me) · Projects FR-2 (CRUD, membership/RBAC, components) · Frontend (login, signup, project list) · CI (GitHub Actions)
- 🔄 **In progress:** Nothing mid-edit — completely clean state at commit `cfcee33`.
- ❌ **Not started:** Sprint 2+ features (Issues FR-3, Kanban FR-4, Comments FR-6, Activity history FR-6.2, Notifications FR-8, Sprints FR-5, Dashboard FR-10, Test cases FR-9, AI triage FR-11).

## Architecture conventions (keep following these)
1. Layers: **router → service → repository**. Routers thin; business rules + permission checks in services; all ORM in repositories.
2. Every new model imported in `app/models/__init__.py` (Alembic + test `create_all` depend on it).
3. Schema changes only via Alembic: `alembic revision --autogenerate -m "..."` then `alembic upgrade head`.
4. Errors: raise `HTTPException` in services. 401 unauthenticated, 403 wrong role, **404 for resources outside caller's projects** (existence hiding), 409 conflicts.
5. All protected endpoints use `Depends(get_current_user)` from `app/core/deps.py`.
6. Tests: in-memory SQLite via `get_db` override (see `tests/conftest.py`). The `signup_user` and `_make_user` fixtures are the patterns to follow.
7. Frontend: all API calls through `src/api/client.js`; JWT header is automatically attached there.
8. New pages go in `src/pages/`; add their route in `src/main.jsx`; protect with `<ProtectedRoute>` where needed.

## Database / migration state
- Dev DB: `backend/devtrack.db` (SQLite, gitignored). Run `alembic upgrade head` to recreate.
- Applied migrations:
  - `76f3a406ccd0` — users table
  - `25468ae6d375` — projects, project_members, components tables

## Commands
```bash
# backend (from backend/)
.venv/Scripts/pip install -r requirements.txt
.venv/Scripts/python -m alembic upgrade head
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
.venv/Scripts/python -m pytest tests/ -q               # 26 tests currently

# frontend (from frontend/)
npm install
npm run dev      # http://localhost:5173
npm run build
```

## Environment variables (see `backend/.env.example`)
`DATABASE_URL`, `CORS_ORIGINS`, `JWT_SECRET`. Later: `ANTHROPIC_API_KEY` (Sprint 5).

## Git log (newest first)
- `cfcee33` frontend auth + project pages + CI workflow
- `b6fa2cb` projects FR-2 backend + RBAC + 26 tests
- `0fefc88` progress history docs (milestones 01-03)
- `57cc7d8` auth FR-1 backend + tests
- `84c238a` progress report doc
- `ca082ba` scaffolds
- `e92b0de` planning docs

**Local repo only — nothing pushed. Never push without the owner's say-so.**

## Exact next task: Sprint 2, Step 1 — Issue CRUD (FR-3) backend

Build the `Issue` model and `Sprint` model together (Sprint is needed for the issue's `sprint_id` FK), Alembic migration, then the full layered stack for issues:
- `IssueType` (TASK/BUG), `Status` (TODO/IN_PROGRESS/TESTING/DONE), `Priority`, `Severity` enums
- `Issue` table per `docs/03-Architecture.md §2` — single table, `type` discriminator, `sprint_id` nullable (null = backlog), `deleted_at` soft delete, `number` + `project_id` unique → generates key like "DEV-42" via atomic `issue_counter` increment
- `Sprint` table (PLANNED/ACTIVE/COMPLETED state, partial unique index one ACTIVE per project)
- Activity log on every status transition (FR-6.2): `Activity` model, append-only
- Schemas: `IssueCreate` (type-dependent validation: BUG requires severity), `IssueUpdate`, `IssueResponse`, `IssueListResponse`
- Endpoints: `GET/POST /projects/{id}/issues` (with filter params: status, type, priority, assignee, sprint, q), `GET/PATCH/DELETE /issues/{id}`
- Tests covering TC-ISS-01..05 from `docs/05-Test-Plan.md`
- **Do not build Sprint endpoints yet** — just the model and FK (Sprint endpoints come in Sprint 4 of the project plan)
