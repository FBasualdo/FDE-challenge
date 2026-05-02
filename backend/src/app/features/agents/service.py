"""Agents service: listing and default-agent seed."""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import AgentORM

logger = logging.getLogger("carrier_sales.agents")

DEFAULT_AGENT_SLUG = "inbound-carrier-sales"
_DEFAULT_AGENT_NAME = "Inbound Carrier Sales"
_DEFAULT_AGENT_DESCRIPTION = (
    "Handles incoming calls from carriers looking to book loads. "
    "Verifies eligibility, pitches loads, negotiates pricing, and "
    "persists call outcomes."
)


async def list_agents(session: AsyncSession) -> list[AgentORM]:
    rows = (await session.execute(select(AgentORM).order_by(AgentORM.name.asc()))).scalars().all()
    return list(rows)


async def seed_default_agent_if_needed(session: AsyncSession) -> None:
    existing = (
        await session.execute(select(AgentORM).where(AgentORM.slug == DEFAULT_AGENT_SLUG))
    ).scalar_one_or_none()
    if existing is not None:
        return

    session.add(
        AgentORM(
            slug=DEFAULT_AGENT_SLUG,
            name=_DEFAULT_AGENT_NAME,
            description=_DEFAULT_AGENT_DESCRIPTION,
            is_active=True,
        )
    )
    await session.commit()
    logger.info("seed_default_agent_if_needed inserted slug=%s", DEFAULT_AGENT_SLUG)
