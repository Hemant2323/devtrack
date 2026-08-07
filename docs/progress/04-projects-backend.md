# Milestone 04 — Project CRUD + RBAC (FR-2)

**Commit:** `b6fa2cb` · **Date:** 6 Aug 2026

## What & why
The first real feature: teams can create projects and invite each other. Every later feature (issues, board, sprints) belongs to a project, so this comes before all of them. RBAC is established here — the role a user holds in a project controls what they can do throughout the system.

## How it works (simple)
1. A user creates a project with a **key** (short code like "DEV") — all issue numbers will be "DEV-1", "DEV-2", etc.
2. The creator automatically becomes **Admin** of the project (FR-2.1).
3. Admin can add members by email and assign roles: Admin, Developer, Tester — **per project** (a user can be Admin of one project and Developer in another).
4. Non-members who query a project get **404**, not 403 — this prevents leaking whether a project exists at all.
5. **Archived** projects reject writes (add member, create issue, etc.) — enforced in the service layer.

## Important files (all under `backend/`)
| File | Role |
|---|---|
| `app/models/project.py` | `projects`, `project_members` (Role enum + unique constraint), `components` tables |
| `app/schemas/project.py` | request/response validation; `key` must match `^[A-Z0-9]+$` |
| `app/repositories/project_repo.py` | all DB queries — including `flush()` trick to get project id before commit (for atomic creator membership) |
| `app/services/project_service.py` | business rules: `_get_project_or_404`, `_require_admin`, `_require_not_archived` helpers used by every operation |
| `app/routers/projects.py` | REST endpoints: projects, `/members`, `/components` subroutes |
| `alembic/versions/25468ae6d375_*` | migration: 3 new tables |
| `tests/test_projects.py` | 13 tests |

## API endpoints added
- `GET/POST /projects` — list own projects / create
- `GET/PATCH /projects/{id}` — get / update (Admin only for update)
- `GET/POST /projects/{id}/members` — list / add
- `PATCH/DELETE /projects/{id}/members/{uid}` — change role / remove
- `GET/POST /projects/{id}/components` — list / add

## Tests performed
`pytest`: **26/26 passed** (13 auth + 13 project tests). Covers TC-PRJ-01..04: creator=Admin, non-member 404, duplicate member 409, archived write 403, plus RBAC enforcement at every mutating endpoint.

## Key concept (beginner)
`db.flush()` writes the object to the DB within the current transaction (gives it an id) without committing yet. We use it to create the project and the creator's membership atomically — if either fails, both roll back.

## State after milestone
Backend fully covers FR-1 and FR-2. 26 tests passing.

## Next step (as of this milestone)
Frontend auth + project pages (see Milestone 05).
