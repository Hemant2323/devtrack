# Milestone 02 — Scaffolding

**Commit:** `ca082ba` · **Date:** 6 Aug 2026

## What & why
Minimal running skeletons of both apps, so every later feature drops into a prepared structure and the frontend↔backend connection is proven early.

## How it works (simple)
- **Backend:** `uvicorn app.main:app` starts FastAPI. `app/config.py` loads settings from `.env`; `app/database.py` creates the SQLAlchemy engine + per-request session (`get_db`). `GET /health` returns `{"status":"ok"}`.
- **Frontend:** Vite dev server serves React on port 5173. `src/api/client.js` is the single helper all API calls go through. The home page calls `/health` and shows online/offline.
- **CORS:** FastAPI middleware allows origin `http://localhost:5173` — without it the browser refuses cross-port requests.

## Important files
`backend/app/{main,config,database}.py` · empty layer packages `models/ schemas/ routers/ services/ repositories/ core/` · `frontend/src/api/client.js` · `frontend/src/App.jsx`

## Tests performed
- `GET /health` → 200 JSON ✓
- CORS header `access-control-allow-origin: http://localhost:5173` present ✓
- Browser page shows "Backend online" ✓
- `npm run build` compiles ✓

## Problems & fixes
- Second uvicorn start failed (port 8000 already in use by first instance) — not a bug; one server is enough.

## State after milestone
Both apps run and talk to each other. No DB tables, no features yet.

## Next step (as of this milestone)
Authentication (FR-1).
