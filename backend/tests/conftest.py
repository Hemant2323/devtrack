"""Shared pytest fixtures.

Strategy: swap the app's real database for a fresh in-memory SQLite per
test (dependency override on get_db). Fast, isolated, and the dev
database is never touched.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401 — register all tables on Base.metadata
from app.database import Base, get_db
from app.main import app


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
