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

    model_config = SettingsConfigDict(env_file=".env")


# A single shared instance imported everywhere: `from app.config import settings`
settings = Settings()
