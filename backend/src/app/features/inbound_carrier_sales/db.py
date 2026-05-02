"""Database engine, session factory, declarative Base, and lifespan helpers.

Stack: SQLAlchemy 2.0 async + asyncpg + Postgres 16.

Schema is now managed by Alembic (see `backend/alembic/`). On boot the
lifespan hook calls `init_db()`, which detects the database state and
either applies pending migrations, stamps an existing unmanaged schema
(the Railway prod takeover case), or applies the baseline on a fresh DB.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Any, AsyncIterator

from sqlalchemy import func, inspect, select
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from alembic import command
from alembic.config import Config
from src.settings import get_settings

logger = logging.getLogger("carrier_sales.db")

# ---------------------------------------------------------------------------
# Declarative base
# ---------------------------------------------------------------------------


class Base(DeclarativeBase):
    """Project-wide declarative base for all ORM models."""


# ---------------------------------------------------------------------------
# Engine / session factory
# ---------------------------------------------------------------------------


_settings = get_settings()
_engine = create_async_engine(
    _settings.database_url,
    echo=False,
    future=True,
    pool_pre_ping=True,
)
_SessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    _engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Resolve `backend/alembic.ini` from this file's location so the bootstrap
# works regardless of the process's CWD (Railway runs from `/app`, local
# devs run from `backend/` or the repo root). Walk up:
#   src/app/features/inbound_carrier_sales/db.py → src → backend
_ALEMBIC_INI = Path(__file__).resolve().parents[4] / "alembic.ini"


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    return _SessionLocal


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency that yields an async session per request."""
    async with _SessionLocal() as session:
        yield session


# ---------------------------------------------------------------------------
# Lifespan helpers
# ---------------------------------------------------------------------------


# Tables we own. If any of these exist on a DB without `alembic_version`,
# we assume it's the existing prod schema and stamp it instead of trying
# to recreate.
_OWNED_TABLES = ("loads", "verifications", "negotiation_rounds", "calls", "users", "agents")


def _alembic_config() -> Config:
    """Build the Alembic Config used by the in-process bootstrap.

    We override `sqlalchemy.url` here too — alembic's command API instantiates
    its own (sync) engine for `stamp`/`upgrade`, so it must see the right URL
    even if env.py also sets it.
    """
    cfg = Config(str(_ALEMBIC_INI))
    cfg.set_main_option("script_location", str(_ALEMBIC_INI.parent / "alembic"))
    cfg.set_main_option("sqlalchemy.url", _settings.database_url)
    return cfg


def _bootstrap_alembic(connection: Connection) -> None:
    """Smart bootstrap, run inside a sync sqlalchemy connection.

    Three cases:
      1. `alembic_version` exists → run `upgrade head` (managed DB,
         applies any new migrations).
      2. Any of our tables exist but no `alembic_version` → run
         `stamp head` (existing prod takeover; idempotent).
      3. Neither → run `upgrade head` (fresh DB, baseline applies).
    """
    inspector = inspect(connection)
    existing_tables = set(inspector.get_table_names())

    cfg = _alembic_config()
    # Hand alembic the live connection so it transacts on the same one
    # we just inspected — avoids opening a second connection that might
    # see a different snapshot under poolless test DBs.
    cfg.attributes["connection"] = connection

    if "alembic_version" in existing_tables:
        logger.info("init_db: alembic_version present → upgrade head")
        command.upgrade(cfg, "head")
    elif any(t in existing_tables for t in _OWNED_TABLES):
        logger.info(
            "init_db: existing unmanaged schema detected → stamp head (idempotent takeover)"
        )
        command.stamp(cfg, "head")
    else:
        logger.info("init_db: empty database → upgrade head (baseline)")
        command.upgrade(cfg, "head")


async def init_db() -> None:
    """Bring the schema up to date and seed first-boot rows. Idempotent."""
    # Import here so models are registered against Base before any
    # autogenerate/inspect runs through env.py's import chain.
    from src.app.features.agents import models as agents_models  # noqa: F401
    from src.app.features.agents.service import seed_default_agent_if_needed
    from src.app.features.users import models as users_models  # noqa: F401
    from src.app.features.users.service import seed_admin_if_needed

    from . import models  # noqa: F401

    # Alembic uses sync engines/connections internally. Bridge by opening
    # an async connection and dispatching the bootstrap via run_sync.
    async with _engine.begin() as conn:
        await conn.run_sync(_bootstrap_alembic)

    async with _SessionLocal() as session:
        existing = (
            await session.execute(select(func.count()).select_from(models.LoadORM))
        ).scalar_one()
        if existing == 0:
            await _seed_loads(session)

        await seed_default_agent_if_needed(session)
        await seed_admin_if_needed(session)


async def _seed_loads(session: AsyncSession) -> None:
    from . import models

    seed_path = Path(_settings.loads_seed_path)
    if not seed_path.exists():
        return
    payload: list[dict[str, Any]] = json.loads(seed_path.read_text(encoding="utf-8"))

    rows: list[models.LoadORM] = []
    for raw in payload:
        rows.append(
            models.LoadORM(
                load_id=raw["load_id"],
                origin=raw["origin"],
                destination=raw["destination"],
                pickup_datetime=_parse_dt(raw["pickup_datetime"]),
                delivery_datetime=_parse_dt(raw["delivery_datetime"]),
                equipment_type=raw["equipment_type"],
                loadboard_rate=Decimal(str(raw["loadboard_rate"])),
                notes=raw.get("notes", ""),
                weight=int(raw["weight"]),
                commodity_type=raw["commodity_type"],
                num_of_pieces=int(raw["num_of_pieces"]),
                miles=int(raw["miles"]),
                dimensions=raw["dimensions"],
            )
        )
    session.add_all(rows)
    await session.commit()


def _parse_dt(raw: str) -> datetime:
    """Parse ISO datetimes, defaulting naive timestamps to UTC for tz-aware columns."""
    dt = datetime.fromisoformat(raw)
    if dt.tzinfo is None:
        from datetime import timezone

        dt = dt.replace(tzinfo=timezone.utc)
    return dt
