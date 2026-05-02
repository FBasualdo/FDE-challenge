"""Alembic environment, async-flavored.

Reads DATABASE_URL from `src.settings.get_settings()` so we get the same
URL normalization (postgres:// → postgresql+asyncpg://) the application
itself uses. Imports every feature's `models` module so all tables are
registered against `Base.metadata` before autogenerate runs.
"""

from __future__ import annotations

import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Project imports — these must come after the standard alembic imports above
# so the env-bootstrap logging is in place. `target_metadata` is built by
# importing `Base` and every feature's `models` module: the import side-effect
# registers each ORM class against `Base.metadata`, which is what
# autogenerate diffs against.
from src.app.features.agents import models as _agents_models  # noqa: F401
from src.app.features.inbound_carrier_sales import models as _ics_models  # noqa: F401
from src.app.features.inbound_carrier_sales.db import Base
from src.settings import get_settings

# Alembic Config object, gives access to values within the .ini file.
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override the placeholder in alembic.ini with the runtime URL from settings.
config.set_main_option("sqlalchemy.url", get_settings().database_url)

# `target_metadata` powers --autogenerate. Base.metadata picks up every
# table whose ORM class was imported above.
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (emit SQL to stdout, no DBAPI)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Open an async engine, then run sync migrations under run_sync."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Online migrations.

    Two paths:
      1. The application's lifespan hook drives migrations from inside an
         async loop. It passes a live sync `Connection` (obtained via
         `await asyncpg_conn.run_sync(...)`) through `config.attributes`.
         We reuse it directly — calling `asyncio.run()` from inside a
         running loop would crash, and creating a second engine is
         unnecessary anyway.
      2. CLI invocation (`alembic upgrade head` from a shell). No
         connection in attributes → spin up our own async engine.
    """
    connectable = config.attributes.get("connection", None)
    if connectable is not None:
        do_run_migrations(connectable)
    else:
        asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
