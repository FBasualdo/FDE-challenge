"""Service layer for dashboard call browsing."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.features.inbound_carrier_sales.models import (
    CallORM,
    NegotiationRoundORM,
    VerificationORM,
)

from .schemas import (
    CallDetail,
    CallListResponse,
    CallSummary,
    NegotiationRoundSummary,
    ToolInvocation,
    VerificationSummary,
)
from .tool_audit import parse_tool_invocations

_PREVIEW_LEN = 200


def _carrier_field(call: CallORM, key: str) -> Any:
    if not call.carrier:
        return None
    return call.carrier.get(key)


def _load_field(call: CallORM, key: str) -> Any:
    if not call.load:
        return None
    return call.load.get(key)


def _negotiation_field(call: CallORM, key: str) -> Any:
    if not call.negotiation:
        return None
    return call.negotiation.get(key)


def _to_summary(call: CallORM) -> CallSummary:
    transcript = call.transcript or ""
    preview = transcript[:_PREVIEW_LEN] if transcript else None

    final = _negotiation_field(call, "final_agreed_rate")
    return CallSummary(
        call_id=call.call_id,
        agent_id=call.agent_id,
        started_at=call.started_at,
        duration_seconds=call.duration_seconds,
        outcome=call.outcome,
        sentiment=call.sentiment,
        carrier_name=_carrier_field(call, "carrier_name"),
        mc_number=_carrier_field(call, "mc_number"),
        load_id=_load_field(call, "load_id"),
        final_agreed_rate=float(final) if final is not None else None,
        transcript_preview=preview,
    )


async def list_calls(
    session: AsyncSession,
    *,
    agent_id: str | None = None,
    outcomes: list[str] | None = None,
    sentiments: list[str] | None = None,
    mc_number: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    q: str | None = None,
    cursor: datetime | None = None,
    limit: int = 50,
) -> CallListResponse:
    base = select(CallORM)
    count_stmt = select(func.count()).select_from(CallORM)

    conditions = []
    if agent_id:
        conditions.append(CallORM.agent_id == agent_id)
    if outcomes:
        conditions.append(CallORM.outcome.in_(outcomes))
    if sentiments:
        conditions.append(CallORM.sentiment.in_(sentiments))
    if mc_number:
        # Carrier MC lives inside the JSONB carrier blob.
        conditions.append(CallORM.carrier["mc_number"].astext == mc_number)
    if date_from:
        conditions.append(CallORM.started_at >= date_from)
    if date_to:
        conditions.append(CallORM.started_at <= date_to)
    if q:
        like = f"%{q}%"
        conditions.append(
            or_(
                CallORM.transcript.ilike(like),
                CallORM.call_id.ilike(like),
            )
        )

    for cond in conditions:
        base = base.where(cond)
        count_stmt = count_stmt.where(cond)

    total = (await session.execute(count_stmt)).scalar_one()

    paged = base
    if cursor is not None:
        paged = paged.where(CallORM.started_at < cursor)
    paged = paged.order_by(CallORM.started_at.desc()).limit(limit + 1)

    rows = list((await session.execute(paged)).scalars().all())
    has_more = len(rows) > limit
    page = rows[:limit]
    next_cursor = page[-1].started_at.isoformat() if has_more and page else None

    return CallListResponse(
        items=[_to_summary(r) for r in page],
        next_cursor=next_cursor,
        total=total,
    )


async def get_call_detail(session: AsyncSession, call_id: str) -> CallDetail | None:
    call = (
        await session.execute(select(CallORM).where(CallORM.call_id == call_id))
    ).scalar_one_or_none()
    if call is None:
        return None

    rounds = list(
        (
            await session.execute(
                select(NegotiationRoundORM)
                .where(NegotiationRoundORM.call_id == call_id)
                .order_by(NegotiationRoundORM.round.asc())
            )
        )
        .scalars()
        .all()
    )

    verifications: list[VerificationORM] = []
    mc = _carrier_field(call, "mc_number")
    if mc:
        verifications = list(
            (
                await session.execute(
                    select(VerificationORM)
                    .where(VerificationORM.mc_number == mc)
                    .order_by(VerificationORM.checked_at.desc())
                    .limit(5)
                )
            )
            .scalars()
            .all()
        )

    tool_invocations = [ToolInvocation(**inv) for inv in parse_tool_invocations(call.transcript)]

    return CallDetail(
        call_id=call.call_id,
        agent_id=call.agent_id,
        started_at=call.started_at,
        ended_at=call.ended_at,
        duration_seconds=call.duration_seconds,
        outcome=call.outcome,
        sentiment=call.sentiment,
        carrier=call.carrier,
        load=call.load,
        negotiation=call.negotiation,
        analysis=call.analysis,
        transcript=call.transcript,
        recording_url=call.recording_url,
        created_at=call.created_at,
        updated_at=call.updated_at,
        negotiation_rounds=[NegotiationRoundSummary.model_validate(r) for r in rounds],
        verifications=[VerificationSummary.model_validate(v) for v in verifications],
        tool_invocations=tool_invocations,
    )
