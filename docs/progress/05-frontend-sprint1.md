# Milestone 05 — Frontend Auth + Project Pages + CI (Sprint 1)

**Commit:** `cfcee33` · **Date:** 6 Aug 2026

## What & why
The backend is usable via curl or Swagger, but the actual product needs a browser UI. This milestone wires the React frontend to the auth and project APIs and sets up automated CI so every future push is verified automatically.

## How it works (simple)
1. **Login/Signup pages** — forms that call `POST /auth/login` and `POST /auth/signup`, store the JWT in `localStorage`, then redirect to `/`.
2. **AuthContext** — a React context that provides `user`, `login`, `signup`, `logout` to any component. On every page load it calls `GET /auth/me` to restore the session from the stored token.
3. **ProtectedRoute** — wraps any route that needs a logged-in user. If not authenticated it redirects to `/login`.
4. **ProjectsPage** — lists the user's projects and has an inline "New project" form.
5. **React Router** — handles `/`, `/login`, `/signup` in `main.jsx`. Unknown paths redirect to `/`.
6. **CI** (`.github/workflows/ci.yml`) — on every push/PR: backend runs `ruff` lint + `pytest`; frontend runs `npm ci` + `npm run build`.

## Important files (under `frontend/src/`)
| File | Role |
|---|---|
| `api/client.js` | Central API helper — attaches `Authorization: Bearer` header, handles 401 errors, saves/clears tokens |
| `auth/AuthContext.jsx` | Shared auth state (user, login, signup, logout) |
| `auth/ProtectedRoute.jsx` | Redirects to `/login` if not authenticated |
| `pages/LoginPage.jsx` / `SignupPage.jsx` | Auth forms with error handling |
| `pages/ProjectsPage.jsx` | Project list + create form |
| `pages/Auth.css` / `Projects.css` | Page-scoped styles |
| `main.jsx` | App entry point — BrowserRouter + AuthProvider + Routes |

## Build verification
`npm run build`: 31 modules, 231 kB JS (74 kB gzip), 4 kB CSS — clean, no errors.

## State after milestone
**Sprint 1 complete.** Full working stack: signup → login → create project → list projects → logout. Backend FR-1 + FR-2 with 26/26 tests. CI pipeline committed.

## Next step (as of this milestone)
Sprint 2: Issue CRUD (FR-3) + Activity history (FR-6.2). See `docs/04-Project-Plan.md`.
