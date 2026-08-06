"""DevTrack API entry point.

`uvicorn app.main:app` finds the `app` object here and serves it.
Routers for each feature area (auth, projects, issues, ...) get mounted
here as they are built, sprint by sprint.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, projects

app = FastAPI(
    title="DevTrack API",
    version="0.1.0",
    description="Project management & bug tracking with AI-assisted triage",
)

# CORS: the browser blocks JS on http://localhost:5173 (React) from calling
# http://localhost:8000 (this API) unless the API explicitly allows it.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router)
app.include_router(projects.router)


@app.get("/health", tags=["system"])
def health_check():
    """Liveness probe: confirms the server is up. Used by the frontend
    scaffold test and later by the deployment platform."""
    return {"status": "ok", "app": "devtrack", "version": app.version}
