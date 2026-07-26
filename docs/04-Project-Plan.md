# Project Plan — DevTrack

**Methodology:** Agile (Scrum), 6 sprints × 1 week each. Dates assume a start of **Mon 3 Aug 2026**; shift as needed.

---

## 1. Milestones

| # | Milestone | Sprint | Target date | Exit criteria |
|---|---|---|---|---|
| M1 | Foundations | S1 | 9 Aug | Auth working end-to-end; project CRUD; CI green |
| M2 | Core tracking | S2–S3 | 23 Aug | Issues + Kanban + comments + history usable by a team |
| M3 | **MVP (college demo)** | S4 | 30 Aug | Sprints, dashboard, search, notifications — demoable |
| M4 | AI triage | S5 | 6 Sep | FR-11 complete with fallback; acceptance metrics logged |
| M5 | Resume version | S6 | 13 Sep | Test cases, ≥70% coverage, deployed publicly, README polished |

## 2. Sprint Backlog

### Sprint 1 — Foundations (3–9 Aug)
- Repo setup, FastAPI + React scaffolds, CI pipeline (lint + test)
- DB models + Alembic baseline migration
- Signup/login/refresh (JWT, bcrypt) — FR-1
- Project CRUD, membership + roles, components — FR-2
- React: auth pages, project list, protected routes

### Sprint 2 — Issues (10–16 Aug)
- Issue CRUD with keys (DEV-42), filters/search API — FR-3, FR-7
- Activity logging on every mutation — FR-6.2
- React: issue list + filters, issue create/edit form, issue detail page

### Sprint 3 — Board & collaboration (17–23 Aug)
- Kanban board API + React drag-and-drop (dnd-kit) — FR-4
- Comments — FR-6.1
- Notifications: assignment, status change, mention — FR-8.1, FR-8.3

### Sprint 4 — Sprints & dashboard → **MVP** (24–30 Aug)
- Sprint lifecycle, backlog planning, sprint report — FR-5
- Dashboard: completion %, charts, burndown — FR-10
- Deadline notification scheduled job — FR-8.2
- Seed-data script + demo walkthrough

### Sprint 5 — AI triage (31 Aug–6 Sep)
- `TriageProvider` interface + Claude provider + mock — FR-11.1–11.4
- Triage UI panel in bug form (suggest → accept/override chips)
- Suggestion logging + acceptance-rate stat on dashboard

### Sprint 6 — Quality & deployment (7–13 Sep)
- Test-case management + runs + fail→bug shortcut — FR-9
- Backend unit/integration tests to ≥70% coverage — NFR-7
- PostgreSQL migration, deploy (Vercel + Render), HTTPS/CORS hardening
- README, screenshots, demo video; *(stretch)* duplicate detection — FR-11.5

## 3. Team & Roles (adapt to your team size)

| Role | Responsibility |
|---|---|
| Backend lead | API, DB, auth, AI service |
| Frontend lead | React app, board, dashboard |
| QA/PM | Test plan, test cases, sprint tracking, report writing |

Solo? Keep the sprint order — it's dependency-sorted. Budget ~60% backend, 40% frontend per sprint.

## 4. Risk Register

| ID | Risk | Prob. | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Scope creep (11 feature areas) | High | High | MVP line after S4; stretch items only in S6 |
| R2 | LLM API cost/downtime | Med | Med | Mock provider for dev/demo; feature is advisory, never blocking (FR-11.4) |
| R3 | Drag-and-drop complexity eats time | Med | Med | dnd-kit library; fallback "Move to…" dropdown ships first |
| R4 | SQLite→Postgres differences | Low | Med | ORM-only access (NFR-8); test against Postgres in CI from S4 |
| R5 | Team member unavailable near deadline | Med | High | Feature branches merged small & often; demoable main at every sprint end |
| R6 | Secret leakage (API keys in repo) | Low | High | `.env` in `.gitignore` from day 1; example file only |

## 5. Estimation (for the report)

Use **story points** (Fibonacci) per backlog item; track velocity per sprint. For the SE report's cost-estimation section, apply **Basic COCOMO** (organic): estimate ~6–8 KLOC → Effort = 2.4 × (KLOC)^1.05 person-months; compare predicted vs. actual at the end — evaluators like the retrospective comparison.

## 6. Definition of Done
A backlog item is Done when: code merged to main via reviewed PR · unit tests pass in CI · manually verified against its FR · no known Critical/Blocker bug open on it.
