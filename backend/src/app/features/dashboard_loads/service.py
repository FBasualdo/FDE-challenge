"""Service layer for the dashboard load catalog.

Filtering rules:
  - `origin` / `destination`: case-insensitive substring (uses Postgres
    `lower(col) LIKE lower(%s)` so the partial-match index is reusable).
  - `equipment_type`: exact case-insensitive match (the seed values are
    canonical: Dry Van / Reefer / Flatbed / Step Deck).
  - `pickup_date_from` / `pickup_date_to`: half-open on the date range
    bounded inclusively at midnight UTC for `_from` and end-of-day UTC
    for `_to` so the natural reading "Jan 1 to Jan 5" includes Jan 5.
  - `status`: 'all' | 'available' | 'booked'. A load is "booked" iff
    there's at least one row in `calls` with outcome='Booked' carrying
    that `load_id` in the JSONB snapshot. Computed at query-time via a
    DISTINCT ON subquery against `calls` — no schema change required.

Pagination is by `pickup_datetime ASC` (older first). The cursor is the
ISO-formatted `pickup_datetime` of the last row served on the previous
page; we additionally tie-break by `load_id ASC` so two loads picking
up at the same instant don't get duplicated or skipped.
"""

from __future__ import annotations

from datetime import date, datetime, time, timezone
from typing import Any, Literal

from sqlalchemy import Select, and_, func, literal_column, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.features.inbound_carrier_sales.models import CallORM, LoadORM
from src.app.features.inbound_carrier_sales.service import _build_pitch_summary

from .schemas import LoadCatalogItem, LoadCatalogResponse

StatusFilter = Literal["all", "available", "booked"]


def _latest_booking_subquery():
    """SQLAlchemy subquery: most recent booked call per load_id.

    Mirrors:
        SELECT DISTINCT ON (load->>'load_id')
            (load->>'load_id') AS load_id,
            started_at         AS booked_at,
            call_id            AS booked_call_id,
            (carrier->>'mc_number')                       AS booked_by_mc,
            (negotiation->>'final_agreed_rate')::numeric  AS booked_agreed_rate
        FROM calls
        WHERE outcome = 'Booked' AND load->>'load_id' IS NOT NULL
        ORDER BY load->>'load_id', started_at DESC

    DISTINCT ON keeps one row per load — the most recent booking — so a
    load that was booked, cancelled in the data, then re-booked still
    surfaces the latest carrier on the dashboard.

    Why `text()` on the JSONB extraction:
      Postgres requires `DISTINCT ON (...)` expressions to be byte-for-byte
      identical to the leading `ORDER BY` expressions. SQLAlchemy's
      operator-form `CallORM.load["load_id"].astext` binds the JSON key
      ('load_id') as a SEPARATE bind parameter every time it's called,
      so the two surface expressions render as `load->>$1` and
      `load->>$7` — Postgres sees them as different and raises
      `InvalidColumnReferenceError`. Using a literal-text fragment
      forces the expression to be a single, reusable column reference.
    """
    load_id_extract = literal_column("calls.load ->> 'load_id'")
    return (
        select(
            load_id_extract.label("load_id"),
            CallORM.started_at.label("booked_at"),
            CallORM.call_id.label("booked_call_id"),
            literal_column("calls.carrier ->> 'mc_number'").label("booked_by_mc"),
            literal_column("calls.negotiation ->> 'final_agreed_rate'").label(
                "booked_agreed_rate_text"
            ),
        )
        .where(
            CallORM.outcome == "Booked",
            load_id_extract.isnot(None),
        )
        .distinct(load_id_extract)
        .order_by(load_id_extract, CallORM.started_at.desc())
        .subquery("latest_booking")
    )


def _row_to_item(row: LoadORM, booking: dict[str, Any] | None) -> LoadCatalogItem:
    booked_rate: float | None = None
    if booking and booking.get("booked_agreed_rate_text") is not None:
        try:
            booked_rate = float(booking["booked_agreed_rate_text"])
        except (TypeError, ValueError):
            booked_rate = None

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
        is_booked=bool(booking),
        booked_at=booking["booked_at"] if booking else None,
        booked_by_mc=booking["booked_by_mc"] if booking else None,
        booked_by_call_id=booking["booked_call_id"] if booking else None,
        booked_agreed_rate=booked_rate,
    )


def _row_to_export_dict(row: LoadORM, booking: dict[str, Any] | None) -> dict[str, Any]:
    """Flat dict shape for the .xlsx export. Every LoadORM column + booking metadata."""
    booked_rate: float | None = None
    if booking and booking.get("booked_agreed_rate_text") is not None:
        try:
            booked_rate = float(booking["booked_agreed_rate_text"])
        except (TypeError, ValueError):
            booked_rate = None

    is_booked = bool(booking)
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
        # Bool renders as a human label so the spreadsheet is filterable
        # and self-explanatory without a legend.
        "is_booked": "Booked" if is_booked else "Available",
        "booked_at": booking["booked_at"] if booking else None,
        "booked_by_mc": booking["booked_by_mc"] if booking else None,
        "booked_by_call_id": booking["booked_call_id"] if booking else None,
        "booked_agreed_rate": booked_rate,
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


def _apply_status_filter(stmt: Select[Any], lb_subq, status: StatusFilter) -> Select[Any]:
    if status == "booked":
        stmt = stmt.where(lb_subq.c.load_id.isnot(None))
    elif status == "available":
        stmt = stmt.where(lb_subq.c.load_id.is_(None))
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
    status: StatusFilter = "all",
) -> LoadCatalogResponse:
    lb = _latest_booking_subquery()

    base = select(
        LoadORM,
        lb.c.booked_at,
        lb.c.booked_call_id,
        lb.c.booked_by_mc,
        lb.c.booked_agreed_rate_text,
        lb.c.load_id.label("lb_load_id"),
    ).join(lb, lb.c.load_id == LoadORM.load_id, isouter=True)
    count_stmt = (
        select(func.count())
        .select_from(LoadORM)
        .join(lb, lb.c.load_id == LoadORM.load_id, isouter=True)
    )

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

    base = _apply_status_filter(base, lb, status)
    count_stmt = _apply_status_filter(count_stmt, lb, status)

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

    result = await session.execute(paged)
    rows = list(result.all())
    has_more = len(rows) > limit
    page = rows[:limit]
    next_cursor = page[-1][0].pickup_datetime.isoformat() if has_more and page else None

    items: list[LoadCatalogItem] = []
    for row in page:
        load_orm = row[0]
        booking: dict[str, Any] | None = None
        if row.lb_load_id is not None:
            booking = {
                "booked_at": row.booked_at,
                "booked_call_id": row.booked_call_id,
                "booked_by_mc": row.booked_by_mc,
                "booked_agreed_rate_text": row.booked_agreed_rate_text,
            }
        items.append(_row_to_item(load_orm, booking))

    return LoadCatalogResponse(
        items=items,
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
    status: StatusFilter = "all",
    cap: int,
) -> tuple[list[dict[str, Any]], bool]:
    """Materialize the filtered catalog (no pagination) for .xlsx export.

    Returns (rows, capped). `capped` is True when the result hit `cap`,
    which the router uses to 400 instead of silently truncating.
    """
    lb = _latest_booking_subquery()
    stmt = select(
        LoadORM,
        lb.c.booked_at,
        lb.c.booked_call_id,
        lb.c.booked_by_mc,
        lb.c.booked_agreed_rate_text,
        lb.c.load_id.label("lb_load_id"),
    ).join(lb, lb.c.load_id == LoadORM.load_id, isouter=True)

    stmt = _apply_filters(
        stmt,
        origin=origin,
        destination=destination,
        equipment_type=equipment_type,
        pickup_date_from=pickup_date_from,
        pickup_date_to=pickup_date_to,
    )
    stmt = _apply_status_filter(stmt, lb, status)
    # +1 so we can detect "exceeded cap" without doing a separate COUNT.
    stmt = stmt.order_by(LoadORM.pickup_datetime.asc(), LoadORM.load_id.asc()).limit(cap + 1)

    result = await session.execute(stmt)
    rows = list(result.all())
    capped = len(rows) > cap
    page = rows[:cap]

    out: list[dict[str, Any]] = []
    for row in page:
        load_orm = row[0]
        booking: dict[str, Any] | None = None
        if row.lb_load_id is not None:
            booking = {
                "booked_at": row.booked_at,
                "booked_call_id": row.booked_call_id,
                "booked_by_mc": row.booked_by_mc,
                "booked_agreed_rate_text": row.booked_agreed_rate_text,
            }
        out.append(_row_to_export_dict(load_orm, booking))
    return out, capped
