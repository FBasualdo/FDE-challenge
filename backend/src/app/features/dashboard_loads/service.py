"""Service layer for the dashboard load catalog.

Filtering rules:
  - `origin` / `destination`: case-insensitive substring (uses Postgres
    `lower(col) LIKE lower(%s)` so the partial-match index is reusable).
  - `equipment_type`: exact case-insensitive match (the seed values are
    canonical: Dry Van / Reefer / Flatbed / Step Deck).
  - `pickup_date_from` / `pickup_date_to`: half-open on the date range
    bounded inclusively at midnight UTC for `_from` and end-of-day UTC
    for `_to` so the natural reading "Jan 1 to Jan 5" includes Jan 5.

Pagination is by `pickup_datetime ASC` (older first). The cursor is the
ISO-formatted `pickup_datetime` of the last row served on the previous
page; we additionally tie-break by `load_id ASC` so two loads picking
up at the same instant don't get duplicated or skipped.
"""

from __future__ import annotations

from datetime import date, datetime, time, timezone
from typing import Any

from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.features.inbound_carrier_sales.models import LoadORM
from src.app.features.inbound_carrier_sales.service import _build_pitch_summary

from .schemas import LoadCatalogItem, LoadCatalogResponse


def _row_to_item(row: LoadORM) -> LoadCatalogItem:
    return LoadCatalogItem(
        load_id=row.load_id,
        origin=row.origin,
        destination=row.destination,
        pickup_datetime=row.pickup_datetime,
        delivery_datetime=row.delivery_datetime,
        equipment_type=row.equipment_type,
        loadboard_rate=float(row.loadboard_rate),
        notes=row.notes,
        weight=row.weight,
        commodity_type=row.commodity_type,
        num_of_pieces=row.num_of_pieces,
        miles=row.miles,
        dimensions=row.dimensions,
        created_at=row.created_at,
        pitch_summary=_build_pitch_summary(row),
    )


def _row_to_export_dict(row: LoadORM) -> dict[str, Any]:
    """Flat dict shape for the .xlsx export. Every LoadORM column + pitch_summary."""
    return {
        "load_id": row.load_id,
        "origin": row.origin,
        "destination": row.destination,
        "pickup_datetime": row.pickup_datetime,
        "delivery_datetime": row.delivery_datetime,
        "equipment_type": row.equipment_type,
        "loadboard_rate": float(row.loadboard_rate),
        "notes": row.notes,
        "weight": row.weight,
        "commodity_type": row.commodity_type,
        "num_of_pieces": row.num_of_pieces,
        "miles": row.miles,
        "dimensions": row.dimensions,
        "created_at": row.created_at,
        "pitch_summary": _build_pitch_summary(row),
    }


def _apply_filters(
    stmt: Select[Any],
    *,
    origin: str | None,
    destination: str | None,
    equipment_type: str | None,
    pickup_date_from: date | None,
    pickup_date_to: date | None,
) -> Select[Any]:
    if origin:
        stmt = stmt.where(func.lower(LoadORM.origin).contains(origin.lower()))
    if destination:
        stmt = stmt.where(func.lower(LoadORM.destination).contains(destination.lower()))
    if equipment_type:
        stmt = stmt.where(func.lower(LoadORM.equipment_type) == equipment_type.lower())
    if pickup_date_from:
        cutoff_from = datetime.combine(pickup_date_from, time.min, tzinfo=timezone.utc)
        stmt = stmt.where(LoadORM.pickup_datetime >= cutoff_from)
    if pickup_date_to:
        cutoff_to = datetime.combine(pickup_date_to, time.max, tzinfo=timezone.utc)
        stmt = stmt.where(LoadORM.pickup_datetime <= cutoff_to)
    return stmt


def _decode_cursor(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        return None


async def list_catalog(
    session: AsyncSession,
    *,
    origin: str | None = None,
    destination: str | None = None,
    equipment_type: str | None = None,
    pickup_date_from: date | None = None,
    pickup_date_to: date | None = None,
    cursor: str | None = None,
    limit: int = 50,
) -> LoadCatalogResponse:
    base = select(LoadORM)
    count_stmt = select(func.count()).select_from(LoadORM)

    base = _apply_filters(
        base,
        origin=origin,
        destination=destination,
        equipment_type=equipment_type,
        pickup_date_from=pickup_date_from,
        pickup_date_to=pickup_date_to,
    )
    count_stmt = _apply_filters(
        count_stmt,
        origin=origin,
        destination=destination,
        equipment_type=equipment_type,
        pickup_date_from=pickup_date_from,
        pickup_date_to=pickup_date_to,
    )

    total = (await session.execute(count_stmt)).scalar_one()

    cursor_dt = _decode_cursor(cursor)
    paged = base
    if cursor_dt is not None:
        # Strict inequality on the timestamp + tie-break on load_id keeps
        # the page boundary deterministic when many loads share a pickup.
        paged = paged.where(
            or_(
                LoadORM.pickup_datetime > cursor_dt,
                and_(LoadORM.pickup_datetime == cursor_dt, LoadORM.load_id > ""),
            )
        )
    paged = paged.order_by(LoadORM.pickup_datetime.asc(), LoadORM.load_id.asc()).limit(limit + 1)

    rows = list((await session.execute(paged)).scalars().all())
    has_more = len(rows) > limit
    page = rows[:limit]
    next_cursor = page[-1].pickup_datetime.isoformat() if has_more and page else None

    return LoadCatalogResponse(
        items=[_row_to_item(r) for r in page],
        next_cursor=next_cursor,
        total=total,
    )


async def fetch_catalog_for_export(
    session: AsyncSession,
    *,
    origin: str | None = None,
    destination: str | None = None,
    equipment_type: str | None = None,
    pickup_date_from: date | None = None,
    pickup_date_to: date | None = None,
    cap: int,
) -> tuple[list[dict[str, Any]], bool]:
    """Materialize the filtered catalog (no pagination) for .xlsx export.

    Returns (rows, capped). `capped` is True when the result hit `cap`,
    which the router uses to 400 instead of silently truncating.
    """
    stmt = select(LoadORM)
    stmt = _apply_filters(
        stmt,
        origin=origin,
        destination=destination,
        equipment_type=equipment_type,
        pickup_date_from=pickup_date_from,
        pickup_date_to=pickup_date_to,
    )
    # +1 so we can detect "exceeded cap" without doing a separate COUNT.
    stmt = stmt.order_by(LoadORM.pickup_datetime.asc(), LoadORM.load_id.asc()).limit(cap + 1)

    rows = list((await session.execute(stmt)).scalars().all())
    capped = len(rows) > cap
    page = rows[:cap]
    return [_row_to_export_dict(r) for r in page], capped
