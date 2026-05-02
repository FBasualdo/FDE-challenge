"""HTTP endpoints for dashboard call list/detail browsing."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.built_in.auth import RequireUser
from src.app.features.exports import (
    EXCEL_MEDIA_TYPE,
    EXPORT_ROW_CAP,
    build_filename,
    write_workbook,
)
from src.app.features.inbound_carrier_sales.db import get_session

from . import service
from .schemas import CallDetail, CallListResponse

router = APIRouter(tags=["Dashboard Calls"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]

# Column spec shared by the export endpoint. Order = column order in the sheet.
_CALLS_COLUMNS: list[tuple[str, str]] = [
    ("call_id", "Call ID"),
    ("agent_name", "Agent"),
    ("started_at", "Started"),
    ("ended_at", "Ended"),
    ("duration_seconds", "Duration (s)"),
    ("mc_number", "MC Number"),
    ("carrier_name", "Carrier"),
    ("eligible", "Eligible"),
    ("load_id", "Load ID"),
    ("origin", "Origin"),
    ("destination", "Destination"),
    ("equipment_type", "Equipment"),
    ("loadboard_rate", "Loadboard Rate"),
    ("final_agreed_rate", "Final Rate"),
    ("num_negotiation_rounds", "Rounds"),
    ("outcome", "Outcome"),
    ("sentiment", "Sentiment"),
    ("decline_reason", "Decline Reason"),
    ("transcript_preview", "Transcript Preview"),
]


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


@router.get("/calls/export.xlsx")
async def export_calls(
    session: SessionDep,
    _user: RequireUser,
    agent_id: Annotated[str | None, Query()] = None,
    outcome: Annotated[list[str] | None, Query()] = None,
    sentiment: Annotated[list[str] | None, Query()] = None,
    mc_number: Annotated[str | None, Query()] = None,
    date_from: Annotated[datetime | None, Query()] = None,
    date_to: Annotated[datetime | None, Query()] = None,
    q: Annotated[str | None, Query()] = None,
) -> Response:
    # NOTE: registered before `/calls/{call_id}` so the literal path
    # wins the FastAPI route match. (Path-param routes would otherwise
    # capture "export.xlsx" as a call_id.)
    rows, capped = await service.fetch_calls_for_export(
        session,
        agent_id=agent_id,
        outcomes=outcome,
        sentiments=sentiment,
        mc_number=mc_number,
        date_from=date_from,
        date_to=date_to,
        q=q,
        cap=EXPORT_ROW_CAP,
    )
    if capped:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Filtered calls exceed export cap of {EXPORT_ROW_CAP:,} rows. "
                "Refine filters and try again."
            ),
        )

    binary = write_workbook("Calls", _CALLS_COLUMNS, rows)
    filename = build_filename("calls")
    return Response(
        content=binary,
        media_type=EXCEL_MEDIA_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
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
