# Milestone 06 — Issue CRUD + Activity History (FR-3, FR-6.2)

**Commit:** `e71afde` · **Date:** 7 Aug 2026

## What & why
Issues are the core work unit everything else revolves around. Activity history is built alongside it because every status change must be recorded in the same DB transaction — you can't add it later cleanly.

## How it works (simple)
1. A member creates an issue with a **type** (TASK or BUG). BUGs must include a `severity`; TASKs must not — validated by Pydantic before the DB is ever touched.
2. The issue gets a **sequential key** like "DEV-42". This is done by incrementing `project.issue_counter` inside the same DB transaction as the issue insert — making keys race-safe even under concurrent requests (TC-ISS-01).
3. Every create/update writes an **Activity** row in the same transaction. The activity log is append-only — no update or delete method exists anywhere in the codebase (NFR-10).
4. **Soft delete**: `DELETE /issues/{id}` (Admin only) sets `deleted_at` rather than removing the row, so activity history is preserved (FR-3.5). All queries filter `deleted_at IS NULL`.
5. The list endpoint accepts query params: `status`, `type`, `priority`, `assignee_id`, `sprint_id`, `q` (text search on title + description).

## Important files (under `backend/`)
| File | Role |
|---|---|
| `app/models/issue.py` | `Issue`, `Sprint` (schema, no endpoints), `Activity` + all enums |
| `app/schemas/issue.py` | `IssueCreate` with `@model_validator` (type-dependent fields), `IssueUpdate`, `IssueResponse` (includes computed `key`), `ActivityResponse` |
| `app/repositories/issue_repo.py` | queries; `create`/`update` use `flush()` not `commit()` — caller controls commit |
| `app/repositories/activity_repo.py` | `log()` (append only) + `get_for_issue()` |
| `app/services/issue_service.py` | RBAC, key generation, activity logging, enum `.value` serialisation fix |
| `app/routers/issues.py` | endpoints |
| `alembic/versions/e1f10b916bf6_*` | migration |
| `tests/test_issues.py` | 9 tests |

## API endpoints added
- `GET /projects/{id}/issues` — list with filters
- `POST /projects/{id}/issues` — create
- `GET /issues/{id}` — detail
- `PATCH /issues/{id}` — update (logs every changed field)
- `DELETE /issues/{id}` — soft delete (Admin only)
- `GET /issues/{id}/activities` — immutable history

## Tests performed
`pytest`: **35/35 passed** (13 auth + 13 projects + 9 issues). Covers TC-ISS-01..05: sequential keys, bug-requires-severity, task-rejects-severity, status-transition-logged, soft-delete-hides-issue; plus filter-by-status, search-by-title, RBAC on delete, append-only check.

## Bug fixed during development
`str(Status.TODO)` produced `'Status.TODO'` (enum's class-qualified repr) instead of `'TODO'`. Fixed by checking `hasattr(v, 'value')` and using `.value` for enum types in the activity logger.

## Key concept (beginner)
`db.flush()` vs `db.commit()`: flush writes to the DB within the current transaction but doesn't finalise it. The repositories use flush; the service layer calls commit once after all related operations (issue insert + activity insert) succeed together. If either fails, both roll back.

## State after milestone
FR-1 + FR-2 + FR-3 + FR-6.2 all working and tested. 35 tests passing.

## Next step (as of this milestone)
Sprint 2 Step 2: Kanban board endpoint (FR-4) + Comments (FR-6.1) + in-app notifications (FR-8).
