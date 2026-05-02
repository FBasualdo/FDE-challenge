"""Service layer for the FMCSA compliance audit log.

Filtering rules:
  - `mc_number`: exact match (carriers identify themselves by MC#).
  - `eligible`: boolean filter on the FMCSA decision.
  - `q`: case-insensitive substring across `mc_number`, `carrier_name`,
    and `reason`. Lets a human grep "BEST" or "out-of-service" without
    knowing which column carries the hit.
  - `date_from` / `date_to`: bounded inclusive on `checked_at`.

Pagination is `checked_at DESC` (newest first) so the audit log opens
with the most recent decisions. Cursor is the ISO timestamp of the
last row served on the previous page; tie-broken by `id DESC` to keep
two checks at the same instant deterministic.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.features.inbound_carrier_sales.models import VerificationORM

from .schemas import VerificationDetail, VerificationListResponse


def _row_to_detail(row: VerificationORM) -> VerificationDetail:
    return VerificationDetail.model_validate(row)


def _row_to_export_dict(row: VerificationORM) -> dict[str, Any]:
    """Flat dict for the .xlsx export. `raw_response` JSONB → dict (writer compacts)."""
    return {
        "id": row.id,
        "mc_number": row.mc_number,
        "eligible": row.eligible,
        "carrier_name": row.carrier_name,
        "dot_number": row.dot_number,
        "status": row.status,
        "reason": row.reason,
        "raw_response": row.raw_response,
        "checked_at": row.checked_at,
    }


def _apply_filters(
    stmt: Select[Any],
    *,
    mc_number: str | None,
    eligible: bool | None,
    q: str | None,
    date_from: datetime | None,
    date_to: datetime | None,
) -> Select[Any]:
    if mc_number:
        stmt = stmt.where(VerificationORM.mc_number == mc_number)
    if eligible is not None:
        stmt = stmt.where(VerificationORM.eligible == eligible)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(
                VerificationORM.mc_number.ilike(like),
                VerificationORM.carrier_name.ilike(like),
                VerificationORM.reason.ilike(like),
            )
        )
    if date_from:
        stmt = stmt.where(VerificationORM.checked_at >= date_from)
    if date_to:
        stmt = stmt.where(VerificationORM.checked_at <= date_to)
    return stmt


def _decode_cursor(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        return None


async def list_verifications(
    session: AsyncSession,
    *,
    mc_number: str | None = None,
    eligible: bool | None = None,
    q: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    cursor: str | None = None,
    limit: int = 50,
) -> VerificationListResponse:
    base = select(VerificationORM)
    count_stmt = select(func.count()).select_from(VerificationORM)

    base = _apply_filters(
        base,
        mc_number=mc_number,
        eligible=eligible,
        q=q,
        date_from=date_from,
        date_to=date_to,
    )
    count_stmt = _apply_filters(
        count_stmt,
        mc_number=mc_number,
        eligible=eligible,
        q=q,
        date_from=date_from,
        date_to=date_to,
    )

    total = (await session.execute(count_stmt)).scalar_one()

    cursor_dt = _decode_cursor(cursor)
    paged = base
    if cursor_dt is not None:
        # Strict inequality + tie-break on `id DESC` for deterministic paging.
        paged = paged.where(
            or_(
                VerificationORM.checked_at < cursor_dt,
                and_(
                    VerificationORM.checked_at == cursor_dt,
                    VerificationORM.id < 2_147_483_647,
                ),
            )
        )
    paged = paged.order_by(VerificationORM.checked_at.desc(), VerificationORM.id.desc()).limit(
        limit + 1
    )

    rows = list((await session.execute(paged)).scalars().all())
    has_more = len(rows) > limit
    page = rows[:limit]
    next_cursor = page[-1].checked_at.isoformat() if has_more and page else None

    return VerificationListResponse(
        items=[_row_to_detail(r) for r in page],
        next_cursor=next_cursor,
        total=total,
    )


async def fetch_verifications_for_export(
    session: AsyncSession,
    *,
    mc_number: str | None = None,
    eligible: bool | None = None,
    q: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    cap: int,
) -> tuple[list[dict[str, Any]], bool]:
    """Materialize the filtered verifications (no pagination) for .xlsx export.

    Returns (rows, capped). `capped` is True when the result hit `cap`,
    which the router uses to 400 instead of silently truncating.
    """
    stmt = select(VerificationORM)
    stmt = _apply_filters(
        stmt,
        mc_number=mc_number,
        eligible=eligible,
        q=q,
        date_from=date_from,
        date_to=date_to,
    )
    stmt = stmt.order_by(VerificationORM.checked_at.desc(), VerificationORM.id.desc()).limit(
        cap + 1
    )

    rows = list((await session.execute(stmt)).scalars().all())
    capped = len(rows) > cap
    page = rows[:cap]
    return [_row_to_export_dict(r) for r in page], capped
