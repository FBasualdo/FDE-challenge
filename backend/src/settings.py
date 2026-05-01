"""Application settings."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/src/settings.py → backend/src → backend → repo root
_REPO_ROOT = Path(__file__).parents[2]
_ROOT_ENV = _REPO_ROOT / ".env"
_LOCAL_ENV = Path(".env")


class _Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=[str(_ROOT_ENV), str(_LOCAL_ENV)],
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    env_stage_name: Literal["LOCAL", "DEV", "STAGING", "PROD"] = Field(
        default="LOCAL", alias="ENV_STAGE_NAME"
    )

    api_key: str = Field(default="", alias="API_KEY")

    fmcsa_webkey: str = Field(default="", alias="FMCSA_WEBKEY")
    use_fmcsa_mock: bool = Field(default=False, alias="USE_FMCSA_MOCK")

    cors_origins: str = Field(
        default="http://localhost:3000,http://localhost:3001",
        alias="CORS_ORIGINS",
    )

    database_url: str = Field(
        default="postgresql+asyncpg://carrier:carrier@localhost:5432/carrier_sales",
        alias="DATABASE_URL",
    )
    loads_seed_path: str = Field(
        default="src/app/features/inbound_carrier_sales/seeds/loads.json",
        alias="LOADS_SEED_PATH",
    )

    @field_validator("database_url", mode="before")
    @classmethod
    def _normalize_database_url(cls, v: str) -> str:
        # Railway (and Heroku-style providers) inject DATABASE_URL with the
        # `postgres://` or `postgresql://` prefix. SQLAlchemy + asyncpg needs
        # the driver in the scheme, so coerce to `postgresql+asyncpg://`
        # unless the user explicitly picked another driver.
        if not isinstance(v, str) or "://" not in v:
            return v
        scheme, rest = v.split("://", 1)
        if scheme in ("postgres", "postgresql"):
            return f"postgresql+asyncpg://{rest}"
        return v


@lru_cache()
def get_settings() -> _Settings:
    return _Settings()
