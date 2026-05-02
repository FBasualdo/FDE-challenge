"""Service layer for the analytics endpoints — thin orchestration only.

Each function fetches the underlying SQL aggregates, applies post-processing
(flag rules, cursor encoding) and returns Pydantic models. SQL strings live
in `carriers.py`, `lanes.py`, `negotiation.py`.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.features.dashboard_calls.schemas import VerificationSummary
from src.app.features.dashboard_calls.service import _to_summary
from src.app.features.inbound_carrier_sales.models import CallORM, VerificationORM

from .carriers import (
    _row_to_carrier_stats_dict,
    decode_cursor,
    encode_cursor,
    fetch_carrier_aggregate,
    fetch_carriers,
    fetch_sentiment_timeline,
)
from .lanes import fetch_lanes
from .negotiation import (
    fetch_acceptance_by_round,
    fetch_final_offer_success_rate,
    fetch_gap_histogram_round1,
    fetch_money_left_on_table,
    fetch_round_one_close_rate,
)
from .schemas import (
    CarrierDetail,
    CarrierListResponse,
    CarrierStats,
    GapBucket,
    LaneListResponse,
    LaneStats,
    MoneyLeftStats,
    NegotiationStats,
    RoundAcceptance,
    SentimentPoint,
)

# ---------------------------------------------------------------------------
# Carriers list
# ---------------------------------------------------------------------------


async def list_carriers(
    session: AsyncSession,
    *,
    sort: str,
    min_calls: int,
    limit: int,
    cursor_raw: str | None,
) -> CarrierListResponse:
    cursor = decode_cursor(cursor_raw) if cursor_raw else None

    rows, total = await fetch_carriers(
        session,
        sort=sort,
        min_calls=min_calls,
        limit=limit,
        cursor=cursor,
    )

    has_more = len(rows) > limit
    page = rows[:limit]

    items = [CarrierStats(**_row_to_carrier_stats_dict(r)) for r in page]

    next_cursor: str | None = None
    if has_more and items:
        last = items[-1]
        sort_value: Any
        if sort == "calls":
            sort_value = last.calls
        elif sort == "booking_rate":
            sort_value = last.booking_rate
        elif sort == "avg_quote_premium":
            sort_value = last.avg_quote_premium_pct
        elif sort == "drop_rate":
            sort_value = last.drop_rate
        else:
            sort_value = last.calls
        next_cursor = encode_cursor(sort_value, last.mc_number)

    return CarrierListResponse(items=items, next_cursor=next_cursor, total=total)


# ---------------------------------------------------------------------------
# Carrier detail
# ---------------------------------------------------------------------------


async def get_carrier_detail(session: AsyncSession, mc_number: str) -> CarrierDetail | None:
    agg = await fetch_carrier_aggregate(session, mc_number)
    if agg is None:
        return None

    stats_dict = _row_to_carrier_stats_dict(agg)

    # Last 10 calls — reuse the dashboard CallSummary mapper so the detail
    # row matches the call list page exactly.
    recent_rows = list(
        (
            await session.execute(
                select(CallORM)
                .where(CallORM.carrier["mc_number"].astext == mc_number)
                .order_by(CallORM.started_at.desc())
                .limit(10)
            )
        )
        .scalars()
        .all()
    )
    recent_calls = [_to_summary(r) for r in recent_rows]

    sentiment_pairs = await fetch_sentiment_timeline(session, mc_number, limit=20)
    sentiment_timeline = [
        SentimentPoint(at=at, sentiment=sentiment) for at, sentiment in sentiment_pairs
    ]

    verification_rows = list(
        (
            await session.execute(
                select(VerificationORM)
                .where(VerificationORM.mc_number == mc_number)
                .order_by(VerificationORM.checked_at.desc())
                .limit(5)
            )
        )
        .scalars()
        .all()
    )
    verifications = [VerificationSummary.model_validate(v) for v in verification_rows]

    return CarrierDetail(
        mc_number=stats_dict["mc_number"],
        carrier_name=stats_dict["carrier_name"],
        total_calls=stats_dict["calls"],
        conversational_calls=stats_dict["conversational_calls"],
        booked=stats_dict["booked"],
        booking_rate=stats_dict["booking_rate"],
        flags=stats_dict["flags"],
        recent_calls=recent_calls,
        sentiment_timeline=sentiment_timeline,
        verifications=verifications,
    )


# ---------------------------------------------------------------------------
# Lanes
# ---------------------------------------------------------------------------


async def list_lanes(
    session: AsyncSession,
    *,
    granularity: str,
    window: str,
    min_calls: int,
    limit: int,
) -> LaneListResponse:
    rows = await fetch_lanes(
        session,
        granularity=granularity,
        window=window,
        min_calls=min_calls,
        limit=limit,
    )
    return LaneListResponse(items=[LaneStats(**r) for r in rows])


# ---------------------------------------------------------------------------
# Negotiation
# ---------------------------------------------------------------------------


async def negotiation_stats(session: AsyncSession) -> NegotiationStats:
    by_round = await fetch_acceptance_by_round(session)
    round_one = await fetch_round_one_close_rate(session)
    final_offer = await fetch_final_offer_success_rate(session)
    histogram = await fetch_gap_histogram_round1(session)
    money = await fetch_money_left_on_table(session)

    return NegotiationStats(
        acceptance_by_round=[RoundAcceptance(**r) for r in by_round],
        round_one_close_rate=round_one,
        final_offer_success_rate=final_offer,
        gap_histogram_round1=[GapBucket(**g) for g in histogram],
        money_left_on_table=MoneyLeftStats(**money),
    )
