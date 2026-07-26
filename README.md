# DevTrack 🚀

Intelligent software project management & bug tracking — a student-focused blend of Jira + GitHub Issues, with **AI-assisted bug triage**.

> Type a bug description like *"Payment page crashes when user applies coupon after selecting UPI"* and DevTrack suggests: **Bug · Severity: High · Component: Payment · Assignee: backend owner** — accept or override with one click.

## Features
- 🔐 JWT auth with per-project roles (Admin / Developer / Tester)
- 📋 Kanban board: To Do → In Progress → Testing → Done
- 🐛 Bug tracker with severity levels & steps-to-reproduce
- 🏃 Sprint management with backlog & burndown
- 💬 Comments, @mentions, immutable activity history
- 🔔 In-app notifications (assignments, status changes, deadlines)
- ✅ Test-case management with pass/fail runs
- 📊 Project dashboard (progress, charts, AI acceptance rate)
- 🤖 AI bug triage (Claude API) — advisory, never blocking, graceful fallback

## Tech Stack
| Layer | Tech |
|---|---|
| Frontend | React (Vite), TanStack Query, dnd-kit, Recharts |
| Backend | FastAPI (Python 3.11+), SQLAlchemy 2, Alembic |
| Database | SQLite (dev) → PostgreSQL (prod) |
| Auth | JWT (access + refresh), bcrypt |
| AI | Anthropic Claude API (structured output) |
| Deploy | Vercel (FE) + Render/Railway (BE) · GitHub Actions CI |

## Documentation
| Doc | Contents |
|---|---|
| [SRS](docs/01-SRS.md) | Functional & non-functional requirements (IEEE 830) |
| [UML Diagrams](docs/02-UML-Diagrams.md) | Use case, class, sequence, activity, component (Mermaid) |
| [Architecture](docs/03-Architecture.md) | Layered design, DB schema, API surface, AI design |
| [Project Plan](docs/04-Project-Plan.md) | 6 sprints, milestones, risk register, COCOMO |
| [Test Plan](docs/05-Test-Plan.md) | Strategy, test cases, traceability |

## Getting Started (once code lands — Sprint 1)
```bash
# backend
cd backend
python -m venv .venv && .venv/Scripts/activate   # Windows
pip install -r requirements.txt
cp .env.example .env        # fill in JWT_SECRET (+ ANTHROPIC_API_KEY for AI)
alembic upgrade head
uvicorn app.main:app --reload

# frontend
cd frontend
npm install
npm run dev
```

## Project Status
📐 **Planning phase complete** — see [Project Plan](docs/04-Project-Plan.md). Sprint 1 (auth + projects) starts next.

## License
MIT
