"""Database setup.

Creates the SQLAlchemy engine (the connection to the DB) and a session
factory (each API request gets its own short-lived session).
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

# `check_same_thread=False` is needed only for SQLite, because FastAPI
# may handle a request on a different thread than the one that opened
# the connection. Harmless for PostgreSQL (ignored).
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False}
    if settings.database_url.startswith("sqlite")
    else {},
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    """All ORM models inherit from this — SQLAlchemy uses it to track tables."""


def get_db():
    """FastAPI dependency: yields a DB session and always closes it after
    the request, even if an error occurred."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
