# HANDOFF — resume DevTrack development here

> Read this + `docs/progress/README.md`, then the milestone reports.
> Architecture source of truth: `docs/03-Architecture.md`. Requirements: `docs/01-SRS.md`.

**Last updated:** 7 Aug 2026, after Milestone 06 — Issue CRUD + Activity history.

## Where we are
- **Sprint 2**, step 1 done.
- ✅ **Working:** Scaffolds · Auth FR-1 · Projects FR-2 (CRUD, membership/RBAC, components) · Issues FR-3 (CRUD, soft delete, sequential keys, search/filter) · Activity log FR-6.2 (append-only, logged in same transaction) · Frontend (login, signup, project list) · CI
- 🔄 **In progress:** Nothing mid-edit — clean state at commit `e71afde`.
- ❌ **Not started (rest of Sprint 2):** Kanban board endpoint FR-4 · Comments FR-6.1 · Notifications FR-8 · Sprint endpoints FR-5 · Dashboard FR-10 · Test cases FR-9 · AI triage FR-11

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
- `e71afde` issues FR-3 + activity log FR-6.2 + 35 tests
- `ccf25a8` Sprint 1 docs
- `cfcee33` frontend auth + project pages + CI
- `b6fa2cb` projects FR-2 backend + RBAC
- `57cc7d8` auth FR-1 backend
- `ca082ba` scaffolds
- `e92b0de` planning docs

**Local repo only — nothing pushed.**

## Exact next task: Sprint 2 Step 2 — Kanban board + Comments + Notifications

### FR-4 Kanban board
`GET /projects/{id}/board` — returns issues (not deleted) grouped into four status buckets: `{todo: [...], in_progress: [...], testing: [...], done: [...]}`. Filter by sprint_id optional. No new model needed; reuses `issue_repo.list_for_project`. New `BoardResponse` schema.

### FR-6.1 Comments
`Comment` model (`id, issue_id FK indexed, author_id FK, body text, created_at, edited_at nullable`). Alembic migration. Schemas: `CommentCreate`, `CommentUpdate`, `CommentResponse`. Repo: `comment_repo` (create, list_for_issue, get_by_id, update, delete). Service: `comment_service` — author can edit/delete own; Admin can delete any; @mention detection logs activity on the issue. Router: `GET/POST /issues/{id}/comments`, `PATCH/DELETE /comments/{id}`.

### FR-8 Notifications (assignment + status-change)
`Notification` model (`id, user_id FK indexed, type enum(ASSIGNED,STATUS_CHANGE,MENTION,DEADLINE), message, issue_id FK nullable, read bool default false, created_at`). Alembic migration. Service helper `notification_service.notify(db, user_id, type, message, issue_id)`. Call it from `issue_service.create_issue` (ASSIGNED when assignee set) and `issue_service.update_issue` (STATUS_CHANGE, ASSIGNED on assignee change). Router: `GET /notifications`, `POST /notifications/read` (body: `{ids: [...]}`).

Tests to cover: board grouping, comment CRUD + author-only edit/delete, admin delete, notification created on assignment, mark-read.

