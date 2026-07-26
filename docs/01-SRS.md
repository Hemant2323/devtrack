# Software Requirements Specification (SRS)

**Project:** DevTrack — Intelligent Software Project Management & Bug Tracking System
**Version:** 1.0
**Date:** 26 July 2026
**Prepared as per:** IEEE 830-1998 (adapted)

---

## 1. Introduction

### 1.1 Purpose
This document specifies the software requirements for **DevTrack**, a web-based project management and bug tracking system for small software teams (student teams, startups). It is intended for developers, testers, evaluators, and project supervisors.

### 1.2 Scope
DevTrack enables teams to:
- Create and manage software projects with role-based team membership
- Track tasks and bugs through a Kanban workflow (To Do → In Progress → Testing → Done)
- Manage sprints with a backlog
- Discuss work items via comments and view a full activity history
- Monitor progress through a project dashboard
- Manage test cases linked to tasks/bugs
- Receive **AI-assisted bug triage**: automatic suggestion of type, severity, component, and assignee from a natural-language bug description

Out of scope (v1.0): real-time collaboration (live cursors), Git integration, time tracking, mobile apps, email delivery (notifications are in-app only).

### 1.3 Definitions, Acronyms, Abbreviations
| Term | Definition |
|---|---|
| Issue | A generic work item — either a **Task** or a **Bug** |
| Sprint | A time-boxed iteration (typically 1–2 weeks) containing selected issues |
| Backlog | Issues not yet assigned to a sprint |
| Triage | Classifying a bug (severity, component, owner) |
| JWT | JSON Web Token — stateless authentication token |
| LLM | Large Language Model (used for AI triage) |
| RBAC | Role-Based Access Control |

### 1.4 References
- IEEE Std 830-1998, Recommended Practice for SRS
- Scrum Guide (2020), Schwaber & Sutherland
- OWASP Top 10 (2021)

### 1.5 Overview
Section 2 gives an overall description; Section 3 lists specific functional and non-functional requirements; Section 4 covers external interfaces.

---

## 2. Overall Description

### 2.1 Product Perspective
DevTrack is a self-contained, new product with a three-tier architecture:
- **Presentation tier:** React single-page application
- **Application tier:** FastAPI (Python) REST API
- **Data tier:** SQLite (development) / PostgreSQL (production) via SQLAlchemy ORM
- **External dependency:** LLM API (Anthropic Claude) for AI triage — the system degrades gracefully when unavailable (manual triage remains fully functional)

### 2.2 Product Functions (summary)
1. User registration, login, and role management
2. Project CRUD and team membership
3. Issue (task/bug) CRUD with priority, deadline, severity, assignee
4. Kanban board with drag-and-drop status transitions
5. Sprint creation, backlog management, sprint reports
6. Comments and immutable activity history per issue
7. Search and multi-criteria filtering of issues
8. In-app notifications (assignment, status change, deadline approaching)
9. Test-case management (steps, expected result, pass/fail runs)
10. Project dashboard (progress %, burndown, issue distribution)
11. AI-assisted bug triage with accept/override

### 2.3 User Classes and Characteristics
| Role | Description | Permissions |
|---|---|---|
| **Admin** | Project owner/manager | Everything: manage project, members, sprints, delete any item |
| **Developer** | Implements tasks/fixes bugs | Create/edit issues, move own issues on board, comment |
| **Tester** | Verifies quality | Create bugs & test cases, record test runs, move issues to Testing/Done, comment |

A user's role is **per project** (a user may be Admin of one project and Developer in another).

### 2.4 Operating Environment
- Server: Linux/Windows, Python 3.11+
- Client: any modern browser (Chrome, Edge, Firefox)
- Database: SQLite 3 (dev), PostgreSQL 15+ (prod)

### 2.5 Design and Implementation Constraints
- REST over HTTPS; JSON payloads
- Stateless auth (JWT); passwords hashed with bcrypt
- AI calls must be server-side only (API key never reaches the client)
- Codebase managed in Git with feature-branch workflow

### 2.6 Assumptions and Dependencies
- Users have stable internet access
- LLM API availability is not guaranteed → AI features are advisory, never blocking
- Team size per project ≤ 20 (performance targets sized accordingly)

---

## 3. Specific Requirements

### 3.1 Functional Requirements

#### FR-1: Authentication & Authorization
- **FR-1.1** The system shall allow signup with name, email, and password (min 8 chars).
- **FR-1.2** The system shall authenticate users via email + password and issue a JWT (access token, 30 min expiry; refresh token, 7 days).
- **FR-1.3** The system shall enforce per-project RBAC as defined in §2.3 on every API endpoint.
- **FR-1.4** The system shall reject requests with missing/expired/invalid tokens with HTTP 401.

#### FR-2: Project Management
- **FR-2.1** A user shall be able to create a project (name, key e.g. "DEV", description); the creator becomes Admin.
- **FR-2.2** An Admin shall be able to add/remove members by email and assign their role.
- **FR-2.3** An Admin shall be able to edit or archive a project. Archived projects are read-only.
- **FR-2.4** Each project shall define a list of **components** (e.g. Payment, Auth, UI) used for issue classification and AI triage.

#### FR-3: Issue Management (Tasks & Bugs)
- **FR-3.1** A member shall be able to create an issue with: type (Task/Bug), title, description, priority (Low/Medium/High/Critical), assignee, deadline, component, labels.
- **FR-3.2** Bugs shall additionally have severity (Minor/Major/Critical/Blocker) and steps-to-reproduce.
- **FR-3.3** Issues shall receive a sequential key within the project (e.g. DEV-42).
- **FR-3.4** The system shall support status transitions To Do → In Progress → Testing → Done (and backward moves), recorded in activity history.
- **FR-3.5** Only Admin may delete issues; delete is soft (recoverable for 30 days).

#### FR-4: Kanban Board
- **FR-4.1** The board shall display four columns (To Do, In Progress, Testing, Done) with issue cards showing key, title, type, priority, assignee avatar.
- **FR-4.2** Drag-and-drop of a card shall update the issue status via the API and notify the assignee.
- **FR-4.3** The board shall be filterable by assignee, type, priority, and sprint.

#### FR-5: Sprint Management
- **FR-5.1** An Admin shall be able to create a sprint (name, start date, end date, goal).
- **FR-5.2** Members shall be able to move issues between backlog and sprint (while sprint is not completed).
- **FR-5.3** Only one sprint per project may be **active** at a time.
- **FR-5.4** On sprint completion, unfinished issues shall return to the backlog, and a sprint report (completed vs. planned) shall be generated.

#### FR-6: Comments & Activity History
- **FR-6.1** Members shall be able to add, edit (own), and delete (own or Admin) comments on issues.
- **FR-6.2** The system shall record an immutable activity log per issue: creation, field changes (old → new value), status moves, comments, assignments — with actor and timestamp.

#### FR-7: Search & Filter
- **FR-7.1** The system shall provide text search over issue key, title, and description within a project.
- **FR-7.2** The system shall support combined filters: type, status, priority, severity, assignee, component, label, sprint.

#### FR-8: Notifications
- **FR-8.1** The system shall create an in-app notification when a user is assigned an issue, when an issue they are assigned changes status, and when they are @mentioned in a comment.
- **FR-8.2** The system shall create a deadline notification 24 hours before an issue's deadline (daily scheduled job).
- **FR-8.3** Users shall be able to mark notifications read; an unread count shall be visible in the header.

#### FR-9: Test-Case Management
- **FR-9.1** A Tester shall be able to create test cases (title, preconditions, steps, expected result) linked to a project and optionally to an issue.
- **FR-9.2** A Tester shall be able to record a test run (pass/fail/blocked + notes); failing a run shall offer one-click bug creation pre-filled from the test case.
- **FR-9.3** The dashboard shall display test pass rate.

#### FR-10: Dashboard
- **FR-10.1** The dashboard shall show: completion % (done / total issues), open bugs by severity, issues by status (pie), issues by assignee (bar), and active-sprint burndown (remaining issues vs. days).
- **FR-10.2** Dashboard data shall reflect changes within 5 seconds of a page load (no stale caching beyond that).

#### FR-11: AI-Assisted Bug Triage
- **FR-11.1** When a user enters a bug description (≥ 15 words) the system shall offer "Suggest triage", which calls the LLM with the description, project component list, and member list.
- **FR-11.2** The AI shall return: type confirmation (bug vs. task), suggested severity, suggested component, suggested assignee (based on component ownership), and a one-line summary — each with a confidence indicator.
- **FR-11.3** The user shall be able to accept all, accept individually, or ignore suggestions; suggestions never auto-apply.
- **FR-11.4** If the LLM call fails or exceeds 10 s, the system shall show "AI unavailable" and allow manual entry (no blocking).
- **FR-11.5** *(v1.1)* On bug creation, the system shall flag probable duplicates via embedding similarity over existing bug titles/descriptions.

### 3.2 Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-1 | Performance | 95th-percentile API response < 500 ms for CRUD endpoints at 50 concurrent users |
| NFR-2 | Performance | Kanban board initial load < 2 s with 200 issues |
| NFR-3 | Security | Passwords hashed (bcrypt, cost ≥ 12); JWT signed HS256; all traffic HTTPS in production |
| NFR-4 | Security | RBAC enforced server-side on every mutating endpoint; OWASP Top 10 mitigations (parameterised queries via ORM, output encoding, CORS allowlist) |
| NFR-5 | Reliability | Graceful degradation when LLM API is down (FR-11.4); target 99% uptime |
| NFR-6 | Usability | Core flows (create issue, move card) achievable in ≤ 3 clicks; responsive ≥ 768 px |
| NFR-7 | Maintainability | Layered architecture (router → service → repository); ≥ 70% unit-test line coverage on backend services |
| NFR-8 | Portability | Database access only via ORM so SQLite ⇄ PostgreSQL swap requires config change only |
| NFR-9 | Scalability | Stateless API tier — horizontally scalable behind a load balancer |
| NFR-10 | Auditability | Activity history is append-only; no endpoint may edit or delete history records |

### 3.3 External Interface Requirements
- **UI:** React SPA; WCAG-AA contrast for text; keyboard-accessible board actions (fallback buttons for drag-and-drop).
- **API:** REST/JSON, documented via auto-generated OpenAPI (Swagger UI at `/docs`).
- **LLM API:** Anthropic Messages API; requests contain only bug text + project metadata (no credentials/PII beyond member display names).
- **Database:** SQLAlchemy 2.x ORM; Alembic migrations.

---

## 4. Requirements Traceability (excerpt)
| Requirement | Design element | Test case |
|---|---|---|
| FR-1.2 | `auth_service.login()` | TC-AUTH-01/02 |
| FR-3.4 | `issue_service.transition()` | TC-ISS-04 |
| FR-4.2 | Board drag handler → `PATCH /issues/{id}` | TC-BRD-02 |
| FR-11.4 | `triage_service` timeout + fallback | TC-AI-03 |

(Full matrix maintained in `05-Test-Plan.md`.)
