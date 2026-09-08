"""Shared pytest fixtures.

Strategy: swap the app's real database for a fresh in-memory SQLite per
test (dependency override on get_db). Fast, isolated, and the dev
database is never touched.
"""

import os

# JWT_SECRET is required with no default, so a deployment cannot run with a
# published key. The suite therefore has to supply one, and it must happen
# before app.config is imported below. setdefault, so a value already in the
# environment still wins.
os.environ.setdefault("JWT_SECRET", "test-only-secret-not-used-in-production")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

import app.models  # noqa: F401,E402 — register all tables on Base.metadata
from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def db_session():
    # StaticPool = every connection is the same one, so the in-memory DB
    # (which lives per-connection) is shared between test and app code.
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestSession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


@pytest.fixture()
def signup_user(client):
    """Helper: registers (and returns) a known test user."""

    def _signup(name="Asha", email="asha@test.dev", password="secret123"):
        response = client.post(
            "/auth/signup", json={"name": name, "email": email, "password": password}
        )
        assert response.status_code == 201, response.text
        return {"email": email, "password": password, **response.json()}

    return _signup
