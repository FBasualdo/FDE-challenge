"""Business logic: pitch rendering, search, negotiation policy, metrics.

Persistence: SQLAlchemy 2.0 async. The session is dependency-injected from the
router via `Depends(get_session)` and threaded through every service call.
That keeps the request/transaction lifecycle owned by FastAPI (one session per
request, auto-closed) and avoids hidden context managers inside service code.
"""

from __future__ import annotations

import logging
import re
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from . import fmcsa_client
from .models import CallORM, LoadORM, NegotiationRoundORM, VerificationORM
from .schemas import (
    CallOutcome,
    CallsByDayEntry,
    CallSentiment,
    EvaluateNegotiationRequest,
    EvaluateNegotiationResponse,
    IngestCallRequest,
    Load,
    MetricsNegotiation,
    MetricsQuality,
    MetricsSummaryResponse,
    MetricsTotals,
    SearchLoadsResponse,
    VerifyCarrierRequest,
    VerifyCarrierResponse,
)

logger = logging.getLogger("carrier_sales.service")

MAX_LOADS_RETURNED = 5


# ---------------------------------------------------------------------------
# Carrier verify
# ---------------------------------------------------------------------------


async def verify_carrier(
    session: AsyncSession, request: VerifyCarrierRequest
) -> VerifyCarrierResponse:
    result = await fmcsa_client.verify_mc(request.mc_number)

    row = VerificationORM(
        mc_number=result["mc_number"],
        eligible=bool(result["eligible"]),
        carrier_name=result.get("carrier_name"),
        dot_number=result.get("dot_number"),
        status=result.get("status"),
        reason=result.get("reason"),
        raw_response=result.get("raw"),
    )
    session.add(row)
    await session.commit()

    return VerifyCarrierResponse(
        eligible=result["eligible"],
        mc_number=result["mc_number"],
        carrier_name=result.get("carrier_name"),
        dot_number=result.get("dot_number"),
        status=result.get("status"),
        allowed_to_operate=result.get("allowed_to_operate"),
        reason=result.get("reason"),
    )


# ---------------------------------------------------------------------------
# Loads search
# ---------------------------------------------------------------------------


def _format_dt(dt: datetime) -> str:
    # Avoid GNU/BSD-only %-d / %-I tokens (they crash on Windows / musl).
    weekday = dt.strftime("%a")
    month = dt.strftime("%b")
    hour12 = dt.hour % 12 or 12
    am_pm = "AM" if dt.hour < 12 else "PM"
    return f"{weekday} {month} {dt.day} at {hour12}:{dt.minute:02d} {am_pm}"


def _build_pitch_summary(row: LoadORM) -> str:
    rate = float(row.loadboard_rate)
    return (
        f"{row.equipment_type} load from {row.origin} to {row.destination}, "
        f"{row.miles} miles, picking up {_format_dt(row.pickup_datetime)}, "
        f"delivering {_format_dt(row.delivery_datetime)}. "
        f"{row.commodity_type}, {row.weight:,} pounds. "
        f"The rate is ${rate:,.0f}."
    )


def _row_to_load(row: LoadORM) -> Load:
    return Load(
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
        pitch_summary=_build_pitch_summary(row),
    )


_NON_ALNUM = re.compile(r"[^A-Z0-9]")


def _normalize_ref(ref: str) -> str:
    # Voice transcription may emit "LD1001", "ld 1001", "LD-1001", "L D 1001".
    # Compare normalized forms so all of those match the canonical "LD-1001".
    return _NON_ALNUM.sub("", ref.upper())


async def search_loads(
    session: AsyncSession,
    *,
    reference_number: str | None,
    origin: str | None,
    destination: str | None,
    equipment_type: str | None,
    pickup_date_from: date | None,
) -> SearchLoadsResponse:
    stmt = select(LoadORM)
    if reference_number:
        normalized = _normalize_ref(reference_number)
        stmt = stmt.where(
            func.regexp_replace(func.upper(LoadORM.load_id), "[^A-Z0-9]", "", "g") == normalized
        )
    if origin:
        stmt = stmt.where(func.lower(LoadORM.origin).contains(origin.lower()))
    if destination:
        stmt = stmt.where(func.lower(LoadORM.destination).contains(destination.lower()))
    if equipment_type:
        stmt = stmt.where(func.lower(LoadORM.equipment_type) == equipment_type.lower())
    if pickup_date_from:
        cutoff = datetime.combine(pickup_date_from, datetime.min.time(), tzinfo=timezone.utc)
        stmt = stmt.where(LoadORM.pickup_datetime >= cutoff)
    stmt = stmt.order_by(LoadORM.pickup_datetime.asc()).limit(MAX_LOADS_RETURNED + 1)

    rows = list((await session.execute(stmt)).scalars().all())
    more = len(rows) > MAX_LOADS_RETURNED
    capped = rows[:MAX_LOADS_RETURNED]
    logger.info(
        "search_loads ref=%s origin=%r dest=%r equip=%r from=%s -> returned=%d more=%s",
        reference_number,
        origin,
        destination,
        equipment_type,
        pickup_date_from,
        len(capped),
        more,
    )
    return SearchLoadsResponse(
        matches_found=len(capped),
        more_available=more,
        loads=[_row_to_load(r) for r in capped],
    )


# ---------------------------------------------------------------------------
# Negotiation engine
# ---------------------------------------------------------------------------


def _round_to_dollar(value: float) -> float:
    return float(round(value))


async def evaluate_negotiation(
    session: AsyncSession, request: EvaluateNegotiationRequest
) -> EvaluateNegotiationResponse:
    """Run the v1 negotiation policy.

    Policy v1:
    - Acceptance rule: if carrier_offer <= loadboard_rate, accept and lock
      agreed_rate = loadboard_rate. We pay our listed rate even if they offer below;
      it keeps booking ops simple and avoids margin leaks from low-ball anchors.
    - Round 1 (offer above loadboard): counter at loadboard*1.05 if they're above
      ceiling (loadboard*1.10), else midpoint capped at the ceiling.
    - Round 2: move 75% from loadboard toward their offer, still capped at ceiling.
    - Round 3: accept if they're at or below ceiling, otherwise reject with
      final_offer = ceiling as a take-it-or-leave-it.
    """
    load = (
        await session.execute(select(LoadORM).where(LoadORM.load_id == request.load_id))
    ).scalar_one_or_none()
    if load is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Load not found: {request.load_id}",
        )

    loadboard = float(load.loadboard_rate)
    ceiling = loadboard * 1.10
    offer = request.carrier_offer
    round_n = request.round_number
    rounds_remaining = max(0, 3 - round_n)

    response: EvaluateNegotiationResponse

    if offer <= loadboard:
        agreed = _round_to_dollar(loadboard)
        response = EvaluateNegotiationResponse(
            action="accept",
            agreed_rate=agreed,
            round_number=round_n,
            rounds_remaining=rounds_remaining,
            message_for_agent=(
                f"The carrier's offer is at or below our listed rate. "
                f"Confirm the deal at ${agreed:,.0f}."
            ),
        )
    elif round_n == 1:
        if offer > ceiling:
            counter = _round_to_dollar(loadboard * 1.05)
        else:
            counter = _round_to_dollar(min((loadboard + offer) / 2, ceiling))
        response = EvaluateNegotiationResponse(
            action="counter",
            counter_price=counter,
            round_number=round_n,
            rounds_remaining=rounds_remaining,
            message_for_agent=(
                f"Counter at ${counter:,.0f} - frame it as 'rates this lane have "
                f"softened but I can stretch a bit.'"
            ),
        )
    elif round_n == 2:
        target = loadboard + 0.75 * (offer - loadboard)
        counter = _round_to_dollar(min(target, ceiling))
        response = EvaluateNegotiationResponse(
            action="counter",
            counter_price=counter,
            round_number=round_n,
            rounds_remaining=rounds_remaining,
            message_for_agent=(
                f"Counter at ${counter:,.0f} - this is close to our ceiling. "
                f"Communicate that you're stretching."
            ),
        )
    else:  # round 3
        if offer <= ceiling:
            agreed = _round_to_dollar(offer)
            response = EvaluateNegotiationResponse(
                action="accept",
                agreed_rate=agreed,
                round_number=round_n,
                rounds_remaining=0,
                message_for_agent=(
                    f"Accept the deal at ${agreed:,.0f}. We've reached our final round "
                    f"and the offer is within ceiling."
                ),
            )
        else:
            final = _round_to_dollar(ceiling)
            response = EvaluateNegotiationResponse(
                action="reject",
                final_offer=final,
                round_number=round_n,
                rounds_remaining=0,
                message_for_agent=(
                    f"Make a final offer of ${final:,.0f} take-it-or-leave-it. "
                    f"If declined, close the call politely."
                ),
            )

    broker_price = (
        response.agreed_rate
        if response.action == "accept"
        else response.counter_price if response.action == "counter" else response.final_offer
    )

    nrow = NegotiationRoundORM(
        call_id=request.call_id,
        load_id=request.load_id,
        round=round_n,
        carrier_offer=Decimal(str(offer)),
        action=response.action,
        broker_price=Decimal(str(broker_price)) if broker_price is not None else None,
    )
    session.add(nrow)
    await session.commit()

    logger.info(
        "negotiate call=%s load=%s round=%d offer=%.2f loadboard=%.2f -> action=%s broker_price=%s",
        request.call_id,
        request.load_id,
        round_n,
        offer,
        loadboard,
        response.action,
        broker_price,
    )
    return response


# ---------------------------------------------------------------------------
# Calls upsert
# ---------------------------------------------------------------------------


async def ingest_call(session: AsyncSession, request: IngestCallRequest) -> bool:
    """Upsert a call. Returns True when newly created, False when updated.

    Uses Postgres `INSERT ... ON CONFLICT (call_id) DO UPDATE` and the xmax=0
    trick: for freshly inserted rows, xmax is 0; for updated rows, xmax is the
    transaction id of the previous version.
    """
    carrier_payload: dict[str, Any] | None = (
        request.carrier.model_dump() if request.carrier else None
    )
    load_payload: dict[str, Any] | None = request.load.model_dump() if request.load else None
    negotiation_payload: dict[str, Any] | None = (
        request.negotiation.model_dump() if request.negotiation else None
    )

    values = {
        "call_id": request.call_id,
        "started_at": request.started_at,
        "ended_at": request.ended_at,
        "duration_seconds": request.duration_seconds,
        "carrier": carrier_payload,
        "load": load_payload,
        "negotiation": negotiation_payload,
        "analysis": request.analysis,
        "outcome": request.outcome.value,
        "sentiment": request.sentiment.value,
        "transcript": request.transcript,
        "recording_url": request.recording_url,
    }

    stmt = pg_insert(CallORM).values(**values)
    update_cols = {k: stmt.excluded[k] for k in values.keys() if k != "call_id"}
    update_cols["updated_at"] = func.now()
    stmt = stmt.on_conflict_do_update(
        index_elements=[CallORM.call_id],
        set_=update_cols,
    ).returning(text("(xmax = 0) AS created"))

    result = await session.execute(stmt)
    created = bool(result.scalar_one())
    await session.commit()
    logger.info(
        "ingest_call call=%s outcome=%s sentiment=%s created=%s",
        request.call_id,
        request.outcome.value,
        request.sentiment.value,
        created,
    )
    return created


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------


def _empty_outcome_distribution() -> dict[str, int]:
    return {o.value: 0 for o in CallOutcome}


def _empty_sentiment_distribution() -> dict[str, int]:
    return {s.value: 0 for s in CallSentiment}


def _call_loadboard_rate(call: CallORM) -> float | None:
    if call.load is None:
        return None
    raw = call.load.get("loadboard_rate")
    return float(raw) if raw is not None else None


def _call_final_rate(call: CallORM) -> float | None:
    if call.negotiation is None:
        return None
    raw = call.negotiation.get("final_agreed_rate")
    return float(raw) if raw is not None else None


def _call_rounds(call: CallORM) -> int | None:
    if call.negotiation is None:
        return None
    raw = call.negotiation.get("rounds")
    return int(raw) if raw is not None else None


def _call_eligible(call: CallORM) -> bool | None:
    if call.carrier is None:
        return None
    raw = call.carrier.get("eligible")
    return None if raw is None else bool(raw)


async def metrics_summary(session: AsyncSession) -> MetricsSummaryResponse:
    calls = list((await session.execute(select(CallORM))).scalars().all())

    outcomes = _empty_outcome_distribution()
    sentiments = _empty_sentiment_distribution()

    booked: list[CallORM] = []
    durations: list[int] = []
    eligibility_known = 0
    eligibility_true = 0

    for c in calls:
        # Defensive: skip rows with values outside the current enum (e.g. left
        # over from a renamed tag). Otherwise the response shape grows keys
        # the dashboard doesn't know about.
        if c.outcome in outcomes:
            outcomes[c.outcome] += 1
        if c.sentiment in sentiments:
            sentiments[c.sentiment] += 1
        durations.append(c.duration_seconds)
        eligible = _call_eligible(c)
        if eligible is not None:
            eligibility_known += 1
            if eligible:
                eligibility_true += 1
        if c.outcome == CallOutcome.BOOKED.value:
            booked.append(c)

    total = len(calls)
    booking_rate = (len(booked) / total) if total else 0.0
    total_revenue = sum((_call_final_rate(c) or 0.0) for c in booked)

    rounds_to_close = [r for r in (_call_rounds(c) for c in booked) if r is not None]
    avg_rounds = (sum(rounds_to_close) / len(rounds_to_close)) if rounds_to_close else None

    margins: list[float] = []
    at_or_below = 0
    above = 0
    for c in booked:
        final_rate = _call_final_rate(c)
        lb = _call_loadboard_rate(c)
        if final_rate is not None and lb is not None:
            margins.append(final_rate - lb)
            if final_rate <= lb:
                at_or_below += 1
            else:
                above += 1

    avg_margin = (sum(margins) / len(margins)) if margins else None

    avg_duration = (sum(durations) / len(durations)) if durations else None
    eligibility_rate = (eligibility_true / eligibility_known) if eligibility_known else None

    today = datetime.now(timezone.utc).date()
    span = [today - timedelta(days=i) for i in range(13, -1, -1)]
    by_day_count: Counter[date] = Counter()
    by_day_booked: Counter[date] = Counter()
    for c in calls:
        d = c.started_at.date()
        if d in span:
            by_day_count[d] += 1
            if c.outcome == CallOutcome.BOOKED.value:
                by_day_booked[d] += 1

    calls_by_day = [
        CallsByDayEntry(date=d, count=by_day_count.get(d, 0), booked=by_day_booked.get(d, 0))
        for d in span
    ]

    return MetricsSummaryResponse(
        totals=MetricsTotals(
            total_calls=total,
            booked_calls=len(booked),
            booking_rate=round(booking_rate, 4),
            total_revenue_negotiated=round(total_revenue, 2),
        ),
        negotiation=MetricsNegotiation(
            avg_rounds_to_close=round(avg_rounds, 2) if avg_rounds is not None else None,
            avg_margin_vs_loadboard=round(avg_margin, 2) if avg_margin is not None else None,
            deals_closed_at_or_below_loadboard=at_or_below,
            deals_closed_above_loadboard=above,
        ),
        quality=MetricsQuality(
            sentiment_distribution=sentiments,
            avg_call_duration_seconds=round(avg_duration, 2) if avg_duration is not None else None,
            carrier_eligibility_rate=(
                round(eligibility_rate, 4) if eligibility_rate is not None else None
            ),
        ),
        outcomes_distribution=outcomes,
        calls_by_day=calls_by_day,
    )
