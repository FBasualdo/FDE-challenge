"""Application settings."""

import logging
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("carrier_sales.settings")

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

    jwt_secret: str = Field(default="", alias="JWT_SECRET")
    jwt_expires_minutes: int = Field(default=60, alias="JWT_EXPIRES_MINUTES")

    seed_admin_email: str = Field(default="", alias="SEED_ADMIN_EMAIL")
    seed_admin_password: str = Field(default="", alias="SEED_ADMIN_PASSWORD")

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
        if not isinstance(v, str) or "://" not in v:
            return v
        scheme, rest = v.split("://", 1)
        if scheme in ("postgres", "postgresql"):
            normalized = f"postgresql+asyncpg://{rest}"
            logger.warning(
                "DATABASE_URL scheme rewritten %r → 'postgresql+asyncpg' for asyncpg compatibility",
                scheme,
            )
            return normalized
        return v

    @model_validator(mode="after")
    def _enforce_api_key_outside_local(self) -> "_Settings":
        # Boot-time guard: refuse to start in any non-LOCAL stage without an
        # API_KEY or JWT_SECRET. Without these, a misconfigured deployment
        # runs wide-open (API_KEY) or hands out unsignable session tokens
        # (JWT_SECRET).
        if self.env_stage_name != "LOCAL":
            if not self.api_key:
                raise ValueError(
                    f"API_KEY must be set when ENV_STAGE_NAME={self.env_stage_name}. "
                    "Refusing to boot in an authenticated environment without auth configured."
                )
            if not self.jwt_secret:
                raise ValueError(
                    f"JWT_SECRET must be set when ENV_STAGE_NAME={self.env_stage_name}. "
                    "Refusing to boot without a signing key for dashboard sessions."
                )
        return self


@lru_cache()
def get_settings() -> _Settings:
    return _Settings()
