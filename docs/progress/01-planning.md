# Milestone 01 — Planning & Documentation

**Commit:** `e92b0de` · **Date:** 26 Jul 2026

## What & why
Complete SE documentation before any code, so the code follows a spec (and the college report material exists from day one).

## What was produced (`docs/`)
- **01-SRS.md** — requirements: FR-1 auth … FR-11 AI triage, 10 NFRs, roles Admin/Developer/Tester (per project)
- **02-UML-Diagrams.md** — use case, class, sequence, activity, component diagrams (Mermaid)
- **03-Architecture.md** — layered design (routers → services → repositories), 13-table DB schema, API surface, AI triage design. **This is the build blueprint.**
- **04-Project-Plan.md** — 6 sprints; MVP after Sprint 4
- **05-Test-Plan.md** — test strategy + cases (TC-XXX-nn ids traced to FRs)

## Key decisions
1. FastAPI + React + SQLite→PostgreSQL (ORM-only access so the swap is config-only)
2. Single `issues` table for tasks and bugs (`type` column distinguishes them)
3. Roles are **per project membership**, not global
4. Activity log is append-only (auditability)
5. AI triage is advisory and must never block manual work

## State after milestone
Docs only — no code yet.

## Next step (as of this milestone)
Sprint 1: scaffolding, auth, project CRUD.
