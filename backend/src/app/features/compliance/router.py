"""HTTP endpoints for the FMCSA compliance audit log.

`GET /verifications`              JSON list with cursor pagination.
`GET /verifications/export.xlsx`  Same filters, no pagination, .xlsx binary.

Both gated with `RequireUser` (dashboard JWT).
"""

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
from .schemas import VerificationListResponse

router = APIRouter(tags=["Compliance"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]

# Column spec shared by the export endpoint. Order = column order in the sheet.
_VERIFICATION_COLUMNS: list[tuple[str, str]] = [
    ("id", "ID"),
    ("checked_at", "Checked At"),
    ("mc_number", "MC Number"),
    ("eligible", "Eligible"),
    ("carrier_name", "Carrier Name"),
    ("dot_number", "DOT Number"),
    ("status", "Status"),
    ("reason", "Reason"),
    ("raw_response", "Raw FMCSA Response"),
]


@router.get("/verifications", response_model=VerificationListResponse)
async def list_verifications(
    session: SessionDep,
    _user: RequireUser,
    mc_number: Annotated[str | None, Query()] = None,
    eligible: Annotated[bool | None, Query()] = None,
    q: Annotated[str | None, Query()] = None,
    date_from: Annotated[datetime | None, Query()] = None,
    date_to: Annotated[datetime | None, Query()] = None,
    cursor: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> VerificationListResponse:
    return await service.list_verifications(
        session,
        mc_number=mc_number,
        eligible=eligible,
        q=q,
        date_from=date_from,
        date_to=date_to,
        cursor=cursor,
        limit=limit,
    )


@router.get("/verifications/export.xlsx")
async def export_verifications(
    session: SessionDep,
    _user: RequireUser,
    mc_number: Annotated[str | None, Query()] = None,
    eligible: Annotated[bool | None, Query()] = None,
    q: Annotated[str | None, Query()] = None,
    date_from: Annotated[datetime | None, Query()] = None,
    date_to: Annotated[datetime | None, Query()] = None,
) -> Response:
    rows, capped = await service.fetch_verifications_for_export(
        session,
        mc_number=mc_number,
        eligible=eligible,
        q=q,
        date_from=date_from,
        date_to=date_to,
        cap=EXPORT_ROW_CAP,
    )
    if capped:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Filtered verifications exceed export cap of {EXPORT_ROW_CAP:,} rows. "
                "Refine filters and try again."
            ),
        )

    binary = write_workbook("Verifications", _VERIFICATION_COLUMNS, rows)
    filename = build_filename("verifications")
    return Response(
        content=binary,
        media_type=EXCEL_MEDIA_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
