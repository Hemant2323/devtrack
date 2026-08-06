# Development Progress Report — DevTrack

> Living record of how DevTrack was built, milestone by milestone.
> Maintained for placements, viva, and project presentations.
> Updated after every major milestone.

---

## Milestone 1 — Planning & Documentation ✅
**Date:** 26 Jul 2026 · **Commit:** `e92b0de`

Full SE documentation set produced before any code (plan-driven development):
- **SRS** (IEEE 830 style): 11 functional requirement groups (FR-1…FR-11), 10 NFRs, per-project RBAC roles (Admin/Developer/Tester)
- **UML** (Mermaid): use case, class/domain model, sequence (AI triage, Kanban move), activity, component diagrams
- **Architecture:** layered monolith (routers → services → repositories), 13-table DB schema, REST API surface, AI triage design with graceful fallback
- **Project plan:** 6 one-week sprints, milestones, risk register, COCOMO estimation hook
- **Test plan:** strategy per level, ~30 test cases traced to FRs

**Key decisions:** FastAPI backend (pairs with Python AI feature), SQLite→PostgreSQL via ORM-only access, single `issues` table with type discriminator, append-only activity log, AI advisory-only (never blocking).

---

## Milestone 2 — Scaffolding (Sprint 1, step 1) ✅
**Date:** 6 Aug 2026 · **Commit:** `ca082ba`

| Piece | Details |
|---|---|
| Backend | FastAPI + uvicorn; layered package structure (`models/ schemas/ routers/ services/ repositories/ core/`) matching the architecture doc |
| Config | `pydantic-settings` reads `.env` → typed `Settings` class; `.env.example` committed, real `.env` gitignored |
| Database foundation | SQLAlchemy 2 engine + session factory + `get_db` dependency; SQLite for dev, URL-swappable to PostgreSQL (NFR-8) |
| API | `GET /health` liveness endpoint; auto-generated Swagger docs at `/docs` |
| CORS | Middleware allowing `http://localhost:5173` — verified via `Access-Control-Allow-Origin` response header |
| Frontend | Vite + React 19; central API client (`src/api/client.js`) — single point for future JWT header; health-check page |
| Verification | Backend `/health` 200 · frontend dev server 200 · React→CORS→FastAPI chain shows "Backend online" · production build compiles (191 kB JS, 60 kB gzip) |

**Environment:** Python 3.13 (venv), Node 24, Git 2.53 on Windows 11.

---

## Milestone 3 — Authentication FR-1 (Sprint 1, step 2) 🔄 in progress

Planned: User model + Alembic migration · bcrypt password hashing · JWT access (30 min) + refresh (7 days) tokens · signup/login/refresh endpoints · layered implementation (schema → router → service → repository) · pytest suite (TC-AUTH-01…05).

---

## Git Milestone Log

| Commit | Milestone |
|---|---|
| `e92b0de` | Planning docs (SRS, UML, architecture, plan, test plan) |
| `ca082ba` | Backend + frontend scaffolds, health check, CORS, verified E2E |
