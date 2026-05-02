"""SQL for the negotiation analytics endpoint.

Three independent aggregates feed the response:

  1. Round-by-round acceptance — pivots `negotiation_rounds` over (round, action).
  2. Round-1 gap histogram — width_bucket on the per-call first-round offer
     normalized by loadboard rate.
  3. Money left on the table — only counts booked calls where the carrier's
     opening quote was strictly above loadboard. Negative deltas clipped to 0.
     Computes total / avg / p50 / p90 in a single CTE via percentile_cont.

Round-1 close rate and final-offer success are also computed here so the
endpoint pulls everything in one round-trip.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def fetch_acceptance_by_round(session: AsyncSession) -> list[dict[str, Any]]:
    sql = """
    SELECT
        round,
        COUNT(*) FILTER (WHERE action = 'accept') AS accepts,
        COUNT(*) FILTER (WHERE action = 'counter') AS counters,
        COUNT(*) FILTER (WHERE action = 'reject') AS rejects
    FROM negotiation_rounds
    WHERE round BETWEEN 1 AND 3
    GROUP BY round
    ORDER BY round ASC
    """
    rows = (await session.execute(text(sql))).mappings().all()
    # Backfill missing rounds (e.g. no round-3 yet) with zeros so the
    # frontend always gets [r1, r2, r3].
    seen = {int(r["round"]): r for r in rows}
    out: list[dict[str, Any]] = []
    for n in (1, 2, 3):
        if n in seen:
            r = seen[n]
            out.append(
                {
                    "round": int(r["round"]),
                    "accepts": int(r["accepts"]),
                    "counters": int(r["counters"]),
                    "rejects": int(r["rejects"]),
                }
            )
        else:
            out.append({"round": n, "accepts": 0, "counters": 0, "rejects": 0})
    return out


async def fetch_round_one_close_rate(session: AsyncSession) -> float | None:
    """Booked calls that closed in round 1 / total booked calls.

    Mirrors the value computed inline in /metrics/summary so they don't drift.
    """
    sql = """
    SELECT
        COUNT(*) FILTER (WHERE outcome = 'Booked') AS booked,
        COUNT(*) FILTER (
            WHERE outcome = 'Booked'
              AND (negotiation->>'rounds')::int = 1
        ) AS round_one_booked
    FROM calls
    """
    row = (await session.execute(text(sql))).mappings().first()
    if row is None or int(row["booked"]) == 0:
        return None
    return round(int(row["round_one_booked"]) / int(row["booked"]), 4)


async def fetch_final_offer_success_rate(session: AsyncSession) -> float | None:
    """Of calls that hit (round=3, action='reject'), what fraction booked?

    The bot rejects with a take-it-or-leave-it final offer at round 3. If
    the carrier capitulates afterward, the call's outcome lands at 'Booked'.
    """
    sql = """
    WITH final_round_rejects AS (
        SELECT DISTINCT call_id
        FROM negotiation_rounds
        WHERE round = 3 AND action = 'reject'
    )
    SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE c.outcome = 'Booked') AS booked
    FROM final_round_rejects fr
    JOIN calls c ON c.call_id = fr.call_id
    """
    row = (await session.execute(text(sql))).mappings().first()
    if row is None or int(row["total"]) == 0:
        return None
    return round(int(row["booked"]) / int(row["total"]), 4)


# Bucket boundaries for the round-1 gap histogram. Aligned with the metric
# plan's UI labels. width_bucket would auto-bin uniformly, but we want
# explicit human-readable labels so we CASE on the percentage instead.
_GAP_BUCKETS = (
    "<-5%",
    "-5..0%",
    "0..5%",
    "5..10%",
    "10..20%",
    ">20%",
)


async def fetch_gap_histogram_round1(session: AsyncSession) -> list[dict[str, Any]]:
    sql = """
    WITH r1 AS (
        SELECT DISTINCT ON (nr.call_id)
            nr.call_id,
            nr.carrier_offer,
            (c.load->>'loadboard_rate')::numeric AS loadboard_rate
        FROM negotiation_rounds nr
        JOIN calls c ON c.call_id = nr.call_id
        WHERE nr.round = 1
        ORDER BY nr.call_id, nr.decided_at ASC
    ),
    pcts AS (
        SELECT
            CASE
                WHEN loadboard_rate IS NULL OR loadboard_rate = 0 THEN NULL
                ELSE (carrier_offer - loadboard_rate) / loadboard_rate
            END AS pct
        FROM r1
    ),
    bucketed AS (
        SELECT
            CASE
                WHEN pct IS NULL THEN NULL
                WHEN pct < -0.05 THEN '<-5%'
                WHEN pct < 0     THEN '-5..0%'
                WHEN pct < 0.05  THEN '0..5%'
                WHEN pct < 0.10  THEN '5..10%'
                WHEN pct < 0.20  THEN '10..20%'
                ELSE '>20%'
            END AS bucket
        FROM pcts
    )
    SELECT bucket, COUNT(*) AS count
    FROM bucketed
    WHERE bucket IS NOT NULL
    GROUP BY bucket
    """
    rows = (await session.execute(text(sql))).mappings().all()
    counts = {r["bucket"]: int(r["count"]) for r in rows}
    return [{"bucket": b, "count": counts.get(b, 0)} for b in _GAP_BUCKETS]


async def fetch_money_left_on_table(session: AsyncSession) -> dict[str, Any]:
    """Negotiated savings vs first ask, restricted per the plan.

    Inclusion rule: booked calls where carrier_quoted_rate > loadboard_rate.
    Per-call value: max(0, carrier_quoted_rate - final_agreed_rate).
    """
    sql = """
    WITH eligible AS (
        SELECT
            GREATEST(
                (analysis->>'carrier_quoted_rate')::numeric
                  - (negotiation->>'final_agreed_rate')::numeric,
                0
            ) AS savings
        FROM calls
        WHERE outcome = 'Booked'
          AND analysis->>'carrier_quoted_rate' IS NOT NULL
          AND negotiation->>'final_agreed_rate' IS NOT NULL
          AND load->>'loadboard_rate' IS NOT NULL
          AND (analysis->>'carrier_quoted_rate')::numeric
                > (load->>'loadboard_rate')::numeric
    )
    SELECT
        COUNT(*) AS savings_count,
        COALESCE(SUM(savings), 0) AS total,
        AVG(savings) AS avg_per_booked_call,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY savings) AS p50,
        percentile_cont(0.9) WITHIN GROUP (ORDER BY savings) AS p90
    FROM eligible
    """
    row = (await session.execute(text(sql))).mappings().first()
    if row is None:
        return {
            "total": 0.0,
            "avg_per_booked_call": None,
            "p50": None,
            "p90": None,
            "savings_count": 0,
        }
    count = int(row["savings_count"])
    return {
        "total": round(float(row["total"] or 0), 2),
        "avg_per_booked_call": (
            round(float(row["avg_per_booked_call"]), 2)
            if row["avg_per_booked_call"] is not None
            else None
        ),
        "p50": round(float(row["p50"]), 2) if row["p50"] is not None else None,
        "p90": round(float(row["p90"]), 2) if row["p90"] is not None else None,
        "savings_count": count,
    }
