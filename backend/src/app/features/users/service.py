"""User service: authentication and admin seeding."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.built_in.auth.jwt import hash_password, verify_password
from src.settings import get_settings

from .models import UserORM

logger = logging.getLogger("carrier_sales.users")


async def authenticate(session: AsyncSession, email: str, password: str) -> UserORM | None:
    normalized = email.strip().lower()
    user = (
        await session.execute(select(UserORM).where(UserORM.email == normalized))
    ).scalar_one_or_none()
    if user is None or not user.is_active:
        return None
    if not verify_password(password, user.password_hash):
        return None

    user.last_login_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(user)
    return user


async def seed_admin_if_needed(session: AsyncSession) -> None:
    """Insert one admin user when the table is empty and seed env vars are set.

    Idempotent — never overwrites existing rows. The admin password is the
    only credential bootstrapping path in v1 (no public registration).
    """
    settings = get_settings()
    if not settings.seed_admin_email or not settings.seed_admin_password:
        return

    existing = (await session.execute(select(func.count()).select_from(UserORM))).scalar_one()
    if existing:
        return

    user = UserORM(
        email=settings.seed_admin_email.strip().lower(),
        password_hash=hash_password(settings.seed_admin_password),
        full_name="Admin",
        is_active=True,
    )
    session.add(user)
    await session.commit()
    logger.info("seed_admin_if_needed inserted admin user email=%s", user.email)
