"""Application settings.

Reads configuration from environment variables and the `.env` file.
Keeping config in one typed class means the rest of the code never
touches os.environ directly, and missing/invalid values fail at startup
instead of deep inside a request.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Where the database lives. SQLite file for development;
    # swapped to a PostgreSQL URL in production (NFR-8).
    database_url: str = "sqlite:///./devtrack.db"

    # Frontend origins allowed to call this API (CORS).
    cors_origins: list[str] = ["http://localhost:5173"]

    # JWT settings (FR-1.2). The secret signs every token, so anyone holding it
    # can mint a session for any user. It is deliberately REQUIRED and has no
    # default: a deployment that forgets to set it fails at startup rather than
    # running with a value published in this repository.
    #
    # Local development supplies it through .env (see .env.example); the test
    # suite sets it in tests/conftest.py before importing the app.
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 30
    refresh_token_days: int = 7

    model_config = SettingsConfigDict(env_file=".env")


# A single shared instance imported everywhere: `from app.config import settings`
settings = Settings()
