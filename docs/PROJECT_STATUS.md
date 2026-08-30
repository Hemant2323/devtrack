# DevTrack — Project Status

> Living document. Updated after every milestone.
> Last updated: 2026-08-08 after Sprint 2 Step 2 commit.

---

## Current State

**Sprint:** 2 complete ✅  
**Next:** Sprint 3 — Frontend Sprint 2 (Kanban board UI, issue detail, comments, notifications)  
**Tests:** 46/46 passing  
**Backend port:** 8000 — `client.js` points to 8000; the earlier 8001 mismatch was resolved in `5b48639`

---

## Completed Features

### Sprint 1 (Milestones 1–5)
| Feature | FR | Notes |
|---|---|---|
| Planning & documentation | — | SRS, UML, architecture, project plan, test plan |
| Backend + frontend scaffolds | — | FastAPI, Vite/React, CORS, `/health` |
| Authentication | FR-1 | Signup, login, JWT access (30 min) + refresh (7 days), bcrypt, `/auth/me` |
| Projects + RBAC | FR-2 | CRUD, Admin/Developer/Tester roles, membership, archived guard, components |
| Frontend auth + project list | — | Login, Signup, ProjectsPage, AuthContext, ProtectedRoute, CI |

### Sprint 2 Step 1 (Milestone 6)
| Feature | FR | Notes |
|---|---|---|
| Issue CRUD | FR-3 | Tasks + bugs, soft delete, sequential keys (DEV-42), type validation |
| Activity log | FR-6.2 | Append-only, logged atomically with every mutation |

### Sprint 2 Step 2 (Milestone 7 — this commit)
| Feature | FR | Notes |
|---|---|---|
| Kanban board endpoint | FR-4 | `GET /projects/{id}/board` — issues grouped by status column; optional `sprint_id` filter |
| Comments | FR-6.1 | Full CRUD; author-only edit; author or Admin delete; activity logged; assignee notified |
| Notifications | FR-8 | ASSIGNED on issue create/reassign; STATUS_CHANGE on status update; MENTION on comment; mark-read |
| Alembic migration | — | `comments` and `notifications` tables (`5018ea08b3a9`) |

---

## Database Schema (current)

| Table | Purpose |
|---|---|
| `users` | id, name, email, hashed_password, created_at |
| `projects` | id, name, key, description, archived, issue_counter, owner_id |
| `project_members` | project_id, user_id, role (ADMIN/DEVELOPER/TESTER) — unique pair |
| `components` | id, project_id, name |
| `sprints` | id, project_id, name, goal, start_date, end_date, state (PLANNED/ACTIVE/COMPLETED) |
| `issues` | id, project_id, sprint_id, number, type (TASK/BUG), title, status, priority, severity*, assignee_id, reporter_id, deleted_at |
| `activities` | id, issue_id, actor_id, action, field, old_value, new_value — append-only |
| `comments` | id, issue_id, author_id, body, created_at, edited_at nullable ← **new** |
| `notifications` | id, user_id, type, message, issue_id, read, created_at ← **new** |

\* `severity` and `steps_to_reproduce` are BUG-only; NULL on TASK rows.

**Applied migrations (in order):**
1. `76f3a406ccd0` — users
2. `25468ae6d375` — projects, project_members, components
3. `e1f10b916bf6` — issues, sprints, activities
4. `5018ea08b3a9` — comments, notifications ← **added this sprint**

---

## API Endpoints

### Auth
```
POST /auth/signup
POST /auth/login
POST /auth/refresh
GET  /auth/me
```

### Projects
```
GET    /projects
POST   /projects
GET    /projects/{id}
PATCH  /projects/{id}
DELETE /projects/{id}
POST   /projects/{id}/members
DELETE /projects/{id}/members/{user_id}
GET    /projects/{id}/components
POST   /projects/{id}/components
```

### Issues
```
POST /projects/{id}/issues
GET  /projects/{id}/issues     ?type, status, priority, assignee_id, sprint_id, q
GET  /issues/{id}
PATCH /issues/{id}
DELETE /issues/{id}
GET  /issues/{id}/activities
```

### Board ← new
```
GET /projects/{id}/board       ?sprint_id (optional)
```
Returns: `{ todo: [...], in_progress: [...], testing: [...], done: [...] }`

### Comments ← new
```
GET    /issues/{id}/comments
POST   /issues/{id}/comments
PATCH  /comments/{id}
DELETE /comments/{id}
```

### Notifications ← new
```
GET  /notifications
POST /notifications/read       body: { ids: [...] }
```

### System
```
GET /health
```

---

## Test Coverage

| File | Tests | Coverage |
|---|---|---|
| `test_auth.py` | 13 | Signup, login, refresh, enumeration guard, token validation |
| `test_projects.py` | 13 | CRUD, RBAC, membership, archive, components |
| `test_issues.py` | 9 | Sequential keys, type validation, status transitions, soft delete, search/filter |
| `test_board_comments_notifs.py` | 11 | Board grouping, comment CRUD + auth, notification creation + mark-read |
| **Total** | **46** | **46/46 passing** |

---

## Frontend Pages (committed)

| Route | Component | Status |
|---|---|---|
| `/login` | LoginPage | ✅ |
| `/signup` | SignupPage | ✅ |
| `/projects` | ProjectsPage (list + create) | ✅ |
| `/projects/:id/board` | Kanban board | ❌ Sprint 3 |
| `/projects/:id/issues/:id` | Issue detail + comments | ❌ Sprint 3 |
| Notification bell (nav) | Unread count + mark-read | ❌ Sprint 3 |

---

## Pending Features

### Sprint 3 — Frontend Sprint 2
- Kanban board page (columns, drag-to-move via PATCH `/issues/{id}`)
- Issue detail page (metadata, description, activity timeline)
- Comment thread on issue detail
- Notification bell in nav bar (unread badge, dropdown, mark-read)
- Project cards clickable → board page
- Adopt TanStack Query for data fetching

### Sprint 4 — Sprint management (FR-5)
- `POST /projects/{id}/sprints`, `PATCH /sprints/{id}` (start/complete)
- Sprint selector on board
- Backlog view (issues with `sprint_id = null`)

### Sprint 5 — Test cases + Dashboard (FR-9, FR-10)
- `TestCase`, `TestRun` models + endpoints
- Dashboard: open vs closed, by-component breakdown, burndown chart (Recharts)

### Sprint 6 — AI triage (FR-11)
- `POST /issues/{id}/triage` → Claude API structured output
- Returns: suggested type, severity, priority, component, assignee
- Accept-or-override UI on issue create form
- Graceful fallback if `ANTHROPIC_API_KEY` not set

---

## Known Issues / Technical Debt

1. **Sprint model has no endpoints yet** — `sprints` table exists, no service or router.
2. **No TanStack Query yet** — `ProjectsPage` uses raw `useEffect`/`fetch`; introduce TQ from Sprint 3.
3. **No `ANTHROPIC_API_KEY` yet** — placeholder; needed only for Sprint 6 AI triage.
