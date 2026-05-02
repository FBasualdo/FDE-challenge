"""HTTP endpoints for the agents catalog."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.built_in.auth import RequireUser
from src.app.features.inbound_carrier_sales.db import get_session

from . import service
from .schemas import Agent, AgentListResponse

router = APIRouter(tags=["Agents"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.get("/agents", response_model=AgentListResponse)
async def list_agents(
    session: SessionDep,
    _user: RequireUser,
) -> AgentListResponse:
    rows = await service.list_agents(session)
    return AgentListResponse(agents=[Agent.model_validate(r) for r in rows])
