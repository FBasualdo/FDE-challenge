"""HTTP endpoints for the dashboard load catalog.

`GET /loads/catalog`              JSON list with cursor pagination.
`GET /loads/catalog/export.xlsx`  Same filters, no pagination, .xlsx binary.

Both gated with `RequireUser` (dashboard JWT). The voice agent's
`/loads/search` endpoint stays separate (different module, `RequireApiKey`).
"""

from __future__ import annotations

from datetime import date
from typing import Annotated, Literal

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
from .schemas import LoadCatalogResponse

router = APIRouter(tags=["Dashboard Loads"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]

# Column spec shared by the export endpoint. Order = column order in the sheet.
# `is_booked` renders as the human label "Booked" / "Available" — set in
# the service's _row_to_export_dict so the spreadsheet stays self-explanatory.
_LOADS_COLUMNS: list[tuple[str, str]] = [
    ("load_id", "Load ID"),
    ("origin", "Origin"),
    ("destination", "Destination"),
    ("pickup_datetime", "Pickup"),
    ("delivery_datetime", "Delivery"),
    ("equipment_type", "Equipment"),
    ("loadboard_rate", "Loadboard Rate"),
    ("miles", "Miles"),
    ("weight", "Weight (lbs)"),
    ("commodity_type", "Commodity"),
    ("num_of_pieces", "Pieces"),
    ("dimensions", "Dimensions"),
    ("notes", "Notes"),
    ("created_at", "Created At"),
    ("pitch_summary", "Pitch Summary"),
    ("is_booked", "Status"),
    ("booked_at", "Booked At"),
    ("booked_by_mc", "Booked By (MC)"),
    ("booked_by_call_id", "Booked Call ID"),
    ("booked_agreed_rate", "Agreed Rate"),
]


@router.get("/loads/catalog", response_model=LoadCatalogResponse)
async def list_catalog(
    session: SessionDep,
    _user: RequireUser,
    origin: Annotated[str | None, Query()] = None,
    destination: Annotated[str | None, Query()] = None,
    equipment_type: Annotated[str | None, Query()] = None,
    pickup_date_from: Annotated[date | None, Query()] = None,
    pickup_date_to: Annotated[date | None, Query()] = None,
    status: Annotated[Literal["all", "available", "booked"], Query()] = "all",
    cursor: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> LoadCatalogResponse:
    return await service.list_catalog(
        session,
        origin=origin,
        destination=destination,
        equipment_type=equipment_type,
        pickup_date_from=pickup_date_from,
        pickup_date_to=pickup_date_to,
        status=status,
        cursor=cursor,
        limit=limit,
    )


@router.get("/loads/catalog/export.xlsx")
async def export_catalog(
    session: SessionDep,
    _user: RequireUser,
    origin: Annotated[str | None, Query()] = None,
    destination: Annotated[str | None, Query()] = None,
    equipment_type: Annotated[str | None, Query()] = None,
    pickup_date_from: Annotated[date | None, Query()] = None,
    pickup_date_to: Annotated[date | None, Query()] = None,
    status_filter: Annotated[Literal["all", "available", "booked"], Query(alias="status")] = "all",
) -> Response:
    rows, capped = await service.fetch_catalog_for_export(
        session,
        origin=origin,
        destination=destination,
        equipment_type=equipment_type,
        pickup_date_from=pickup_date_from,
        pickup_date_to=pickup_date_to,
        status=status_filter,
        cap=EXPORT_ROW_CAP,
    )
    if capped:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Filtered catalog exceeds export cap of {EXPORT_ROW_CAP:,} rows. "
                "Refine filters and try again."
            ),
        )

    binary = write_workbook("Loads", _LOADS_COLUMNS, rows)
    filename = build_filename("loads-catalog")
    return Response(
        content=binary,
        media_type=EXCEL_MEDIA_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
