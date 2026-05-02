"""HTTP endpoints for dashboard call list/detail browsing."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.built_in.auth import RequireUser
from src.app.features.inbound_carrier_sales.db import get_session

from . import service
from .schemas import CallDetail, CallListResponse

router = APIRouter(tags=["Dashboard Calls"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.get("/calls", response_model=CallListResponse)
async def list_calls(
    session: SessionDep,
    _user: RequireUser,
    agent_id: Annotated[str | None, Query()] = None,
    outcome: Annotated[list[str] | None, Query()] = None,
    sentiment: Annotated[list[str] | None, Query()] = None,
    mc_number: Annotated[str | None, Query()] = None,
    date_from: Annotated[datetime | None, Query()] = None,
    date_to: Annotated[datetime | None, Query()] = None,
    q: Annotated[str | None, Query()] = None,
    cursor: Annotated[datetime | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> CallListResponse:
    return await service.list_calls(
        session,
        agent_id=agent_id,
        outcomes=outcome,
        sentiments=sentiment,
        mc_number=mc_number,
        date_from=date_from,
        date_to=date_to,
        q=q,
        cursor=cursor,
        limit=limit,
    )


@router.get("/calls/{call_id}", response_model=CallDetail)
async def get_call(
    call_id: str,
    session: SessionDep,
    _user: RequireUser,
) -> CallDetail:
    detail = await service.get_call_detail(session, call_id)
    if detail is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Call not found: {call_id}",
        )
    return detail
