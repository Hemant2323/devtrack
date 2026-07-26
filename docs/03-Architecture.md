# Architecture & Database Design — DevTrack

---

## 1. Architecture Overview

**Style:** Three-tier, layered monolith. A monolith is the right call for a 2–4 person student team: one deployable backend, one repo, no distributed-systems overhead — while the internal layering keeps it modular enough to discuss in the SE report (and to split later if ever needed).

```
Browser (React SPA)
      │  HTTPS · JSON · JWT in Authorization header
      ▼
FastAPI application
  ┌────────────────────────────────────────────┐
  │ Routers      – HTTP concerns, validation   │   (FastAPI + Pydantic)
  │ Services     – business rules, RBAC, AI    │   (plain Python)
  │ Repositories – persistence queries         │   (SQLAlchemy 2.x)
  └────────────────────────────────────────────┘
      │                               │
      ▼                               ▼
 SQLite / PostgreSQL           Claude API (triage only)
```

**Layering rules (enforce in code review):**
1. Routers never touch the ORM directly — only services.
2. Services contain all business rules (e.g. "only one active sprint") and all permission checks.
3. Repositories contain all queries; no SQL/ORM outside them.
4. The LLM client lives behind a `TriageProvider` interface so it can be mocked in tests and swapped between providers.

### Backend folder structure

```
backend/
├── app/
│   ├── main.py               # FastAPI app, CORS, router mounting
│   ├── config.py             # Settings via pydantic-settings (.env)
│   ├── database.py           # engine, session factory
│   ├── models/               # SQLAlchemy models (one file per aggregate)
│   │   ├── user.py  project.py  issue.py  sprint.py
│   │   ├── comment.py  activity.py  notification.py  testcase.py
│   ├── schemas/              # Pydantic request/response models
│   ├── routers/              # auth.py projects.py issues.py sprints.py
│   │                         # boards.py triage.py testcases.py notifications.py
│   ├── services/             # auth_service.py project_service.py
│   │                         # issue_service.py sprint_service.py
│   │                         # triage_service.py notification_service.py
│   ├── repositories/         # user_repo.py project_repo.py issue_repo.py ...
│   ├── core/                 # security.py (JWT, bcrypt), permissions.py (RBAC)
│   └── ai/                   # triage_provider.py (interface),
│                             # claude_provider.py, mock_provider.py
├── alembic/                  # migrations
├── tests/                    # pytest: unit (services) + integration (API)
└── requirements.txt
```

### Frontend folder structure

```
frontend/src/
├── api/            # axios instance + typed API functions
├── auth/           # AuthContext, ProtectedRoute, token refresh
├── components/     # shared UI (IssueCard, PriorityBadge, Avatar…)
├── features/
│   ├── board/      # Kanban (dnd-kit), column, card
│   ├── issues/     # issue form (with AI triage panel), detail, filters
│   ├── sprints/    # sprint list, backlog planning
│   ├── dashboard/  # charts (Recharts)
│   ├── testcases/  # test case CRUD + run recording
│   └── notifications/
└── pages/          # route-level components
```

---

## 2. Database Design (ER model)

### Tables

**users**
| column | type | notes |
|---|---|---|
| id | int PK | |
| name | varchar(100) | |
| email | varchar(255) unique | login identifier |
| password_hash | varchar(60) | bcrypt |
| created_at | timestamp | |

**projects**
| column | type | notes |
|---|---|---|
| id | int PK | |
| name | varchar(100) | |
| key | varchar(10) unique | e.g. "DEV" → issue keys DEV-1… |
| description | text | |
| archived | bool default false | |
| issue_counter | int default 0 | source of sequential issue numbers |
| created_at | timestamp | |

**project_members** — RBAC pivot
| column | type | notes |
|---|---|---|
| id | int PK | |
| project_id | FK → projects | |
| user_id | FK → users | |
| role | enum(ADMIN, DEVELOPER, TESTER) | |
| | | unique(project_id, user_id) |

**components**
| column | type | notes |
|---|---|---|
| id | int PK | |
| project_id | FK | |
| name | varchar(50) | e.g. Payment, Auth |
| default_assignee_id | FK → users nullable | feeds AI assignee suggestion |

**issues** — single table for tasks and bugs (type discriminator; bug-only columns nullable)
| column | type | notes |
|---|---|---|
| id | int PK | |
| project_id | FK, indexed | |
| sprint_id | FK nullable | null = backlog |
| number | int | unique(project_id, number) → key "DEV-42" |
| type | enum(TASK, BUG) | |
| title | varchar(200) | |
| description | text | |
| status | enum(TODO, IN_PROGRESS, TESTING, DONE), indexed | |
| priority | enum(LOW, MEDIUM, HIGH, CRITICAL) | |
| severity | enum(MINOR, MAJOR, CRITICAL, BLOCKER) nullable | bugs only |
| steps_to_reproduce | text nullable | bugs only |
| component_id | FK nullable | |
| assignee_id | FK → users nullable, indexed | |
| reporter_id | FK → users | |
| deadline | date nullable | |
| deleted_at | timestamp nullable | soft delete (FR-3.5) |
| created_at / updated_at | timestamp | |

**sprints**
| column | type | notes |
|---|---|---|
| id | int PK | |
| project_id | FK | |
| name, goal | varchar / text | |
| start_date, end_date | date | |
| state | enum(PLANNED, ACTIVE, COMPLETED) | partial unique index: one ACTIVE per project |

**comments**: id, issue_id FK, author_id FK, body text, created_at, edited_at nullable

**activities** (append-only): id, issue_id FK indexed, actor_id FK, action varchar(30), field varchar(30) nullable, old_value / new_value text nullable, created_at

**notifications**: id, user_id FK indexed, type enum(ASSIGNED, STATUS_CHANGE, MENTION, DEADLINE), message varchar(255), issue_id FK nullable, read bool default false, created_at

**test_cases**: id, project_id FK, issue_id FK nullable, title, preconditions text, steps text, expected_result text, created_by FK

**test_runs**: id, test_case_id FK, executed_by FK, result enum(PASS, FAIL, BLOCKED), notes text, executed_at

**triage_suggestions**: id, project_id FK, issue_id FK nullable (set when accepted), input_description text, suggested_severity, suggested_component_id FK nullable, suggested_assignee_id FK nullable, summary varchar(255), confidence float, accepted bool, created_at
*(kept as a log → lets you report AI acceptance-rate metrics — great for the report/demo)*

### Design decisions worth defending in the report
1. **Single `issues` table** (not separate task/bug tables): shared workflow, board, comments; avoids duplicated FKs and UNION queries. Discriminator = `type`.
2. **`issue_counter` on projects** instead of `MAX(number)+1`: increment atomically inside a transaction (`SELECT … FOR UPDATE` on Postgres) to make keys race-safe.
3. **Soft delete via `deleted_at`**: satisfies FR-3.5 and keeps activity history intact; all queries filter `deleted_at IS NULL` in the repository layer.
4. **Append-only `activities`**: auditability (NFR-10) — the model has no update/delete methods.
5. **Roles are per-membership**, not global — matches real tools (Jira) and makes RBAC a project-scoped check.

---

## 3. API Design (summary)

Full spec auto-generated by FastAPI at `/docs`. Core surface:

| Method & path | Purpose | Roles |
|---|---|---|
| POST `/auth/signup`, `/auth/login`, `/auth/refresh` | Auth | public |
| GET/POST `/projects` · GET/PATCH/DELETE `/projects/{id}` | Projects | member / admin |
| GET/POST `/projects/{id}/members` · PATCH/DELETE `/projects/{id}/members/{uid}` | Membership | admin |
| GET/POST `/projects/{id}/components` | Components | admin |
| GET/POST `/projects/{id}/issues` (rich query params: status, type, priority, assignee, component, sprint, q) | Issues + search (FR-7) | member |
| GET/PATCH/DELETE `/issues/{id}` | Issue detail; PATCH covers status transitions | member / admin(del) |
| GET/POST `/issues/{id}/comments` | Comments | member |
| GET `/issues/{id}/activities` | History | member |
| GET/POST `/projects/{id}/sprints` · POST `/sprints/{id}/start` · POST `/sprints/{id}/complete` | Sprints | admin |
| GET `/projects/{id}/board` | Board payload (issues grouped by status) | member |
| GET `/projects/{id}/dashboard` | Aggregated stats | member |
| POST `/projects/{id}/triage` | AI triage suggestion | member |
| GET/POST `/projects/{id}/testcases` · POST `/testcases/{id}/runs` | Test management | tester/admin |
| GET `/notifications` · POST `/notifications/read` | Notifications | self |

Conventions: JWT in `Authorization: Bearer`; 401 unauthenticated, 403 role failure, 404 for resources outside the caller's projects (prevents existence leaks); cursor pagination via `?limit=&after=`.

---

## 4. AI Triage Design

**Prompt strategy (server-side, `claude_provider.py`):**
- System prompt: "You are a bug-triage assistant for a software project. Classify strictly using the provided component and member lists. Respond only with JSON matching the schema."
- User message: bug description + JSON of components (name + default assignee) + members (name + role).
- Use **structured output** (JSON schema): `{is_bug, severity, component, assignee, summary, confidence, reasoning}`.
- Model: `claude-haiku-4-5` (fast + cheap — triage is a classification task); temperature 0.
- Timeout 10 s; on failure raise `TriageUnavailableError` → 503 (FR-11.4).

**Safety/robustness:**
- The bug description is untrusted user input — the prompt instructs the model to treat it as data; server validates the response against the Pydantic schema and rejects hallucinated component/member names (fall back to "no suggestion" per field).
- API key only in server env (`.env`, never committed).
- `mock_provider.py` returns deterministic suggestions → tests and offline demos need no API key.

**v1.1 duplicate detection:** embed title+description on bug creation, cosine similarity vs existing bugs in the project, flag > 0.85 as probable duplicate. Store vectors in a simple table (project is small-scale; no vector DB needed).

---

## 5. Deployment View

```
Vercel (frontend, static)  ──HTTPS──▶  Render/Railway (FastAPI, Docker)
                                            │
                                            ├─▶ Managed PostgreSQL
                                            └─▶ Anthropic API
```

- CI (GitHub Actions): on PR → ruff lint, pytest, frontend build. On merge to main → deploy.
- Config via env vars: `DATABASE_URL`, `JWT_SECRET`, `ANTHROPIC_API_KEY`, `CORS_ORIGINS`.
- Alembic migration runs as a release step before app start.
