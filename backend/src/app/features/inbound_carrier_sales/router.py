"""HTTP endpoints for inbound carrier sales."""

from __future__ import annotations

import logging
from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.built_in.auth import RequireApiKey, RequireUser

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
preview_logger = logging.getLogger("carrier_sales.preview")


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
    return await service.verify_carrier(session, VerifyCarrierRequest(mc_number=mc_number))


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
    if request.started_at and request.ended_at and request.ended_at < request.started_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ended_at must be on or after started_at",
        )
    created = await service.ingest_call(session, request)
    return IngestCallResponse(saved=True, call_id=request.call_id, created=created)


@router.post("/calls/preview")
async def preview_call_payload(
    payload: Annotated[dict[str, Any], Body()],
    _: None = RequireApiKey,
) -> dict[str, Any]:
    """Inspect a call payload WITHOUT persisting.

    Accepts any JSON body, logs it in full, and reports whether the same
    payload would validate against /calls. Use it to discover what your
    voice platform actually emits before committing to the strict schema.
    Nothing gets written to the database.
    """
    preview_logger.info("preview payload received: %s", payload)

    would_pass = True
    parsed: dict[str, Any] | None = None
    errors: list[dict[str, Any]] = []
    try:
        validated = IngestCallRequest.model_validate(payload)
        parsed = validated.model_dump(mode="json")
    except ValidationError as exc:
        would_pass = False
        errors = [
            {"loc": list(e["loc"]), "type": e["type"], "msg": e["msg"], "input": e.get("input")}
            for e in exc.errors()
        ]

    return {
        "received": payload,
        "would_validate": would_pass,
        "errors": errors,
        "parsed": parsed,
    }


@router.get("/metrics/summary", response_model=MetricsSummaryResponse)
async def metrics_summary(
    session: SessionDep,
    _user: RequireUser,
) -> MetricsSummaryResponse:
    # Dashboard-only read endpoint: gate with the user JWT, not the
    # service API key. The voice agent never queries aggregated metrics.
    return await service.metrics_summary(session)
