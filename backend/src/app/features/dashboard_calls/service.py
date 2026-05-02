"""Service layer for dashboard call browsing."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.features.agents.models import AgentORM
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
# Export-only: transcripts can be 200k chars; the spreadsheet column
# only needs enough to identify the call. 500 chars matches the spec.
_EXPORT_TRANSCRIPT_PREVIEW_LEN = 500


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


def _to_summary(call: CallORM, agent_name: str | None = None) -> CallSummary:
    transcript = call.transcript or ""
    preview = transcript[:_PREVIEW_LEN] if transcript else None

    final = _negotiation_field(call, "final_agreed_rate")
    rounds = _negotiation_field(call, "rounds")
    loadboard = _load_field(call, "loadboard_rate")
    return CallSummary(
        call_id=call.call_id,
        agent_id=call.agent_id,
        agent_name=agent_name,
        started_at=call.started_at,
        duration_seconds=call.duration_seconds,
        outcome=call.outcome,
        sentiment=call.sentiment,
        carrier_name=_carrier_field(call, "carrier_name"),
        mc_number=_carrier_field(call, "mc_number"),
        load_id=_load_field(call, "load_id"),
        origin=_load_field(call, "origin"),
        destination=_load_field(call, "destination"),
        loadboard_rate=float(loadboard) if loadboard is not None else None,
        final_agreed_rate=float(final) if final is not None else None,
        num_negotiation_rounds=int(rounds) if rounds is not None else None,
        transcript_preview=preview,
    )


def _apply_call_filters(
    stmt: Select[Any],
    *,
    agent_id: str | None,
    outcomes: list[str] | None,
    sentiments: list[str] | None,
    mc_number: str | None,
    date_from: datetime | None,
    date_to: datetime | None,
    q: str | None,
) -> Select[Any]:
    if agent_id:
        stmt = stmt.where(CallORM.agent_id == agent_id)
    if outcomes:
        stmt = stmt.where(CallORM.outcome.in_(outcomes))
    if sentiments:
        stmt = stmt.where(CallORM.sentiment.in_(sentiments))
    if mc_number:
        # Carrier MC lives inside the JSONB carrier blob.
        stmt = stmt.where(CallORM.carrier["mc_number"].astext == mc_number)
    if date_from:
        stmt = stmt.where(CallORM.started_at >= date_from)
    if date_to:
        stmt = stmt.where(CallORM.started_at <= date_to)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(
                CallORM.transcript.ilike(like),
                CallORM.call_id.ilike(like),
            )
        )
    return stmt


async def _resolve_agent_names(session: AsyncSession, agent_ids: set[str]) -> dict[str, str]:
    if not agent_ids:
        return {}
    rows_agents = (
        (await session.execute(select(AgentORM).where(AgentORM.slug.in_(agent_ids))))
        .scalars()
        .all()
    )
    return {a.slug: a.name for a in rows_agents}


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
    base = _apply_call_filters(
        select(CallORM),
        agent_id=agent_id,
        outcomes=outcomes,
        sentiments=sentiments,
        mc_number=mc_number,
        date_from=date_from,
        date_to=date_to,
        q=q,
    )
    count_stmt = _apply_call_filters(
        select(func.count()).select_from(CallORM),
        agent_id=agent_id,
        outcomes=outcomes,
        sentiments=sentiments,
        mc_number=mc_number,
        date_from=date_from,
        date_to=date_to,
        q=q,
    )

    total = (await session.execute(count_stmt)).scalar_one()

    paged = base
    if cursor is not None:
        paged = paged.where(CallORM.started_at < cursor)
    paged = paged.order_by(CallORM.started_at.desc()).limit(limit + 1)

    rows = list((await session.execute(paged)).scalars().all())
    has_more = len(rows) > limit
    page = rows[:limit]
    next_cursor = page[-1].started_at.isoformat() if has_more and page else None

    # Resolve agent_id → name in a single query so the table can show the
    # human-friendly label without an N+1.
    agent_names = await _resolve_agent_names(session, {r.agent_id for r in page if r.agent_id})

    return CallListResponse(
        items=[_to_summary(r, agent_name=agent_names.get(r.agent_id)) for r in page],
        next_cursor=next_cursor,
        total=total,
    )


def _call_to_export_dict(call: CallORM, agent_name: str | None) -> dict[str, Any]:
    """Flat dict for the .xlsx export. Mirrors the spec's column list exactly."""
    transcript = call.transcript or ""
    preview = transcript[:_EXPORT_TRANSCRIPT_PREVIEW_LEN] if transcript else None

    final = _negotiation_field(call, "final_agreed_rate")
    rounds = _negotiation_field(call, "rounds")
    loadboard = _load_field(call, "loadboard_rate")
    decline_reason = (
        call.analysis.get("decline_reason") if isinstance(call.analysis, dict) else None
    )

    return {
        "call_id": call.call_id,
        "agent_name": agent_name or call.agent_id,
        "started_at": call.started_at,
        "ended_at": call.ended_at,
        "duration_seconds": call.duration_seconds,
        "mc_number": _carrier_field(call, "mc_number"),
        "carrier_name": _carrier_field(call, "carrier_name"),
        "eligible": _carrier_field(call, "eligible"),
        "load_id": _load_field(call, "load_id"),
        "origin": _load_field(call, "origin"),
        "destination": _load_field(call, "destination"),
        "equipment_type": _load_field(call, "equipment_type"),
        "loadboard_rate": float(loadboard) if loadboard is not None else None,
        "final_agreed_rate": float(final) if final is not None else None,
        "num_negotiation_rounds": int(rounds) if rounds is not None else None,
        "outcome": call.outcome,
        "sentiment": call.sentiment,
        "decline_reason": decline_reason,
        "transcript_preview": preview,
    }


async def fetch_calls_for_export(
    session: AsyncSession,
    *,
    agent_id: str | None = None,
    outcomes: list[str] | None = None,
    sentiments: list[str] | None = None,
    mc_number: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    q: str | None = None,
    cap: int,
) -> tuple[list[dict[str, Any]], bool]:
    """Materialize the filtered calls (no pagination) for .xlsx export.

    Returns (rows, capped). `capped` is True when the result hit `cap`,
    which the router uses to 400 instead of silently truncating.
    """
    stmt = _apply_call_filters(
        select(CallORM),
        agent_id=agent_id,
        outcomes=outcomes,
        sentiments=sentiments,
        mc_number=mc_number,
        date_from=date_from,
        date_to=date_to,
        q=q,
    )
    # +1 so we can detect "exceeded cap" without a separate COUNT.
    stmt = stmt.order_by(CallORM.started_at.desc()).limit(cap + 1)

    rows = list((await session.execute(stmt)).scalars().all())
    capped = len(rows) > cap
    page = rows[:cap]

    agent_names = await _resolve_agent_names(session, {r.agent_id for r in page if r.agent_id})
    return [_call_to_export_dict(r, agent_names.get(r.agent_id)) for r in page], capped


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
