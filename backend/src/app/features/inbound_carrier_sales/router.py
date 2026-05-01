"""HTTP endpoints for inbound carrier sales."""

from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.built_in.auth import RequireApiKey

from . import service
from .db import get_session
from .schemas import (
    EvaluateNegotiationRequest,
    EvaluateNegotiationResponse,
    IngestCallRequest,
    IngestCallResponse,
    MetricsSummaryResponse,
    SearchLoadsResponse,
    VerifyCarrierRequest,
    VerifyCarrierResponse,
)

router = APIRouter(tags=["Inbound Carrier Sales"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.post("/carriers/verify", response_model=VerifyCarrierResponse)
async def verify_carrier(
    request: VerifyCarrierRequest,
    session: SessionDep,
    _: None = RequireApiKey,
) -> VerifyCarrierResponse:
    if not request.mc_number or not request.mc_number.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="mc_number is required",
        )
    return await service.verify_carrier(session, request)


@router.get("/carriers/verify", response_model=VerifyCarrierResponse)
async def verify_carrier_get(
    session: SessionDep,
    mc_number: Annotated[str, Query(description="Carrier MC number, with or without 'MC' prefix")],
    _: None = RequireApiKey,
) -> VerifyCarrierResponse:
    # GET variant for clients (e.g. HappyRobot Action nodes) that only emit
    # query strings. Same behavior as the POST endpoint.
    if not mc_number.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="mc_number is required",
        )
    return await service.verify_carrier(
        session, VerifyCarrierRequest(mc_number=mc_number)
    )


@router.get("/loads/search", response_model=SearchLoadsResponse)
async def search_loads(
    session: SessionDep,
    reference_number: Annotated[str | None, Query()] = None,
    origin: Annotated[str | None, Query()] = None,
    destination: Annotated[str | None, Query()] = None,
    equipment_type: Annotated[str | None, Query()] = None,
    pickup_date_from: Annotated[date | None, Query()] = None,
    _: None = RequireApiKey,
) -> SearchLoadsResponse:
    if not any([reference_number, origin, destination, equipment_type, pickup_date_from]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one search filter is required",
        )
    return await service.search_loads(
        session,
        reference_number=reference_number,
        origin=origin,
        destination=destination,
        equipment_type=equipment_type,
        pickup_date_from=pickup_date_from,
    )


@router.post("/negotiations/evaluate", response_model=EvaluateNegotiationResponse)
async def evaluate_negotiation(
    request: EvaluateNegotiationRequest,
    session: SessionDep,
    _: None = RequireApiKey,
) -> EvaluateNegotiationResponse:
    return await service.evaluate_negotiation(session, request)


@router.post("/calls", response_model=IngestCallResponse)
async def ingest_call(
    request: IngestCallRequest,
    session: SessionDep,
    _: None = RequireApiKey,
) -> IngestCallResponse:
    if request.ended_at < request.started_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ended_at must be on or after started_at",
        )
    created = await service.ingest_call(session, request)
    return IngestCallResponse(saved=True, call_id=request.call_id, created=created)


@router.get("/metrics/summary", response_model=MetricsSummaryResponse)
async def metrics_summary(
    session: SessionDep,
    _: None = RequireApiKey,
) -> MetricsSummaryResponse:
    return await service.metrics_summary(session)
