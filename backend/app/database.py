"""Database setup.

Creates the SQLAlchemy engine (the connection to the DB) and a session
factory (each API request gets its own short-lived session).
"""

from datetime import datetime, timezone

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
    # Managed PostgreSQL closes connections that have sat idle, and a pooled
    # connection that the server has already dropped surfaces as a failed
    # request rather than a reconnect. pre_ping spends one round trip
    # validating a connection on checkout; recycle retires it before the
    # provider does. Pool sizing is left at the SQLAlchemy default (5 + 10
    # overflow), which suits a small deployment.
    pool_pre_ping=True,
    pool_recycle=1800,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def utcnow() -> datetime:
    """The current UTC instant, without a tzinfo, for timestamp columns.

    Every timestamp column in this application is a naive DateTime, i.e.
    TIMESTAMP WITHOUT TIME ZONE on PostgreSQL. SQLite silently discards the
    tzinfo of an aware value, so writing datetime.now(timezone.utc) happened to
    store UTC. PostgreSQL does not discard it: the driver sends a timestamptz
    and the server converts it into the column using its own TimeZone setting,
    so on a server that is not set to UTC the stored value would shift.

    Dropping the tzinfo here makes the written value identical on both engines
    and independent of any server setting. It is UTC because the caller asked
    for UTC — no conversion happens, only the label is removed.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


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
