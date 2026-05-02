"""HTTP endpoints for the analytics feature.

All endpoints are gated by `RequireUser` (dashboard JWT only). The voice
agent never queries analytics. Each response is cached in-process for 15s
keyed by endpoint + query params.
"""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.built_in.auth import RequireUser
from src.app.features.inbound_carrier_sales.db import get_session

from . import service
from .cache import analytics_cache
from .schemas import (
    CarrierDetail,
    CarrierListResponse,
    LaneListResponse,
    NegotiationStats,
)

router = APIRouter(tags=["Analytics"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.get("/metrics/carriers", response_model=CarrierListResponse)
async def list_carriers(
    session: SessionDep,
    _user: RequireUser,
    sort: Annotated[
        Literal[
            "calls",
            "booking_rate",
            "avg_quote_premium_pct",
            "drop_rate",
            "last_called_at",
        ],
        Query(),
    ] = "calls",
    min_calls: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    cursor: Annotated[str | None, Query()] = None,
) -> CarrierListResponse:
    cache_key = analytics_cache.make_key(
        "carriers_list",
        {"sort": sort, "min_calls": min_calls, "limit": limit, "cursor": cursor},
    )
    cached = await analytics_cache.get(cache_key)
    if cached is not None:
        return CarrierListResponse.model_validate(cached)

    response = await service.list_carriers(
        session, sort=sort, min_calls=min_calls, limit=limit, cursor_raw=cursor
    )
    await analytics_cache.set(cache_key, response.model_dump(mode="json"))
    return response


@router.get("/metrics/carriers/{mc_number}", response_model=CarrierDetail)
async def get_carrier_detail(
    mc_number: str,
    session: SessionDep,
    _user: RequireUser,
) -> CarrierDetail:
    cache_key = analytics_cache.make_key("carriers_detail", {"mc_number": mc_number})
    cached = await analytics_cache.get(cache_key)
    if cached is not None:
        return CarrierDetail.model_validate(cached)

    detail = await service.get_carrier_detail(session, mc_number)
    if detail is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No calls found for MC {mc_number}",
        )
    await analytics_cache.set(cache_key, detail.model_dump(mode="json"))
    return detail


@router.get("/metrics/lanes", response_model=LaneListResponse)
async def list_lanes(
    session: SessionDep,
    _user: RequireUser,
    granularity: Annotated[Literal["city", "state"], Query()] = "city",
    window: Annotated[Literal["7d", "14d", "30d", "all"], Query()] = "14d",
    min_calls: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
) -> LaneListResponse:
    cache_key = analytics_cache.make_key(
        "lanes_list",
        {
            "granularity": granularity,
            "window": window,
            "min_calls": min_calls,
            "limit": limit,
        },
    )
    cached = await analytics_cache.get(cache_key)
    if cached is not None:
        return LaneListResponse.model_validate(cached)

    response = await service.list_lanes(
        session,
        granularity=granularity,
        window=window,
        min_calls=min_calls,
        limit=limit,
    )
    await analytics_cache.set(cache_key, response.model_dump(mode="json"))
    return response


@router.get("/metrics/negotiation", response_model=NegotiationStats)
async def negotiation_stats(
    session: SessionDep,
    _user: RequireUser,
) -> NegotiationStats:
    cache_key = analytics_cache.make_key("negotiation_stats", {})
    cached = await analytics_cache.get(cache_key)
    if cached is not None:
        return NegotiationStats.model_validate(cached)

    response = await service.negotiation_stats(session)
    await analytics_cache.set(cache_key, response.model_dump(mode="json"))
    return response
