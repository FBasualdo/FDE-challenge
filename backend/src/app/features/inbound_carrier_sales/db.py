"""Database engine, session factory, declarative Base, and lifespan helpers.

Stack: SQLAlchemy 2.0 async + asyncpg + Postgres 16.

NOTE: Alembic is intentionally NOT used in v1. We rely on
`Base.metadata.create_all(...)` at startup to bootstrap the schema. Once the
schema stabilizes (post-MVP), we'll wire up Alembic and migrate this file to
emit a baseline revision instead of create_all. — v2.
"""

from __future__ import annotations

import json
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Any, AsyncIterator

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from src.settings import get_settings

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


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    return _SessionLocal


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency that yields an async session per request."""
    async with _SessionLocal() as session:
        yield session


# ---------------------------------------------------------------------------
# Lifespan helpers
# ---------------------------------------------------------------------------


async def init_db() -> None:
    """Create tables if needed and seed loads on first boot. Idempotent."""
    # Import here so models are registered against Base before create_all runs.
    from src.app.features.agents import models as agents_models  # noqa: F401
    from src.app.features.agents.service import seed_default_agent_if_needed
    from src.app.features.users import models as users_models  # noqa: F401
    from src.app.features.users.service import seed_admin_if_needed

    from . import models  # noqa: F401

    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Bridge migrations until Alembic lands in v2. `create_all` only adds
        # tables that don't exist — it never alters existing ones — so new
        # columns must be opened here. Each statement is idempotent.
        for stmt in _PENDING_MIGRATIONS:
            await conn.execute(text(stmt))

    async with _SessionLocal() as session:
        existing = (
            await session.execute(select(func.count()).select_from(models.LoadORM))
        ).scalar_one()
        if existing == 0:
            await _seed_loads(session)

        await seed_default_agent_if_needed(session)
        await seed_admin_if_needed(session)


_PENDING_MIGRATIONS: tuple[str, ...] = (
    "ALTER TABLE calls ADD COLUMN IF NOT EXISTS analysis JSONB",
    "ALTER TABLE calls ADD COLUMN IF NOT EXISTS agent_id VARCHAR(64) "
    "DEFAULT 'inbound-carrier-sales'",
    "UPDATE calls SET agent_id = 'inbound-carrier-sales' WHERE agent_id IS NULL",
    "ALTER TABLE calls ALTER COLUMN agent_id SET NOT NULL",
    "CREATE INDEX IF NOT EXISTS ix_calls_agent_id ON calls (agent_id)",
)


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
