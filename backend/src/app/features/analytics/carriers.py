"""SQL for the per-carrier leaderboard and per-carrier drill-in.

All aggregation is pushed into Postgres (`COUNT FILTER`, JSONB casts,
`AVG((expr)::numeric)`). The Python layer only formats and applies the
flag rules — no row-level math.
"""

from __future__ import annotations

import base64
import json
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# Order-by clauses keyed by the `sort` query param. We always tie-break on
# `mc_number` ascending so cursor pagination is deterministic.
_SORT_CLAUSES: dict[str, str] = {
    "calls": "calls DESC, mc_number ASC",
    "booking_rate": "booking_rate DESC, mc_number ASC",
    "avg_quote_premium": "avg_quote_premium_pct DESC NULLS LAST, mc_number ASC",
    "drop_rate": "drop_rate DESC, mc_number ASC",
}


def encode_cursor(sort_value: Any, mc_number: str) -> str:
    payload = json.dumps([sort_value, mc_number], default=str)
    return base64.urlsafe_b64encode(payload.encode("utf-8")).decode("ascii")


def decode_cursor(raw: str) -> tuple[Any, str] | None:
    try:
        decoded = base64.urlsafe_b64decode(raw.encode("ascii")).decode("utf-8")
        sort_value, mc_number = json.loads(decoded)
        return sort_value, mc_number
    except (ValueError, TypeError, json.JSONDecodeError):
        return None


# Per-MC aggregate. Used both by the list endpoint (with pagination) and
# by the detail endpoint (single MC). We compute everything once and let
# the wrapping SELECT add the cursor predicates / ORDER BY / LIMIT.
#
# Notes:
#   - We split the heavy CASEs across the per_call CTE so subsequent
#     CASE expressions reference plain column names (Postgres can't see
#     the SELECT-list aliases inside the same level).
#   - `sentiment_trend` is built via a correlated lateral subselect
#     against the per_call CTE because we need the last 5 events ordered
#     by time, not by row insertion.
#   - Carrier-name picking is a correlated subquery against the source
#     tables (verifications first, calls second) so it stays in sync
#     with the metrics-plan rule of "verification wins".
_PER_MC_SQL = """
WITH per_call AS (
    SELECT
        c.carrier->>'mc_number' AS mc_number,
        c.outcome,
        c.sentiment,
        c.started_at,
        (c.analysis->>'carrier_quoted_rate')::numeric AS carrier_quoted_rate,
        (c.load->>'loadboard_rate')::numeric AS loadboard_rate
    FROM calls c
    WHERE c.carrier->>'mc_number' IS NOT NULL
      AND c.carrier->>'mc_number' <> ''
),
agg AS (
    SELECT
        mc_number,
        COUNT(*) AS calls,
        COUNT(*) FILTER (WHERE outcome <> 'Not Eligible') AS conversational_calls,
        COUNT(*) FILTER (WHERE outcome = 'Booked') AS booked,
        COUNT(*) FILTER (WHERE outcome = 'Call Dropped') AS dropped,
        AVG(
          CASE
            WHEN sentiment = 'Positive' THEN 1
            WHEN sentiment = 'Negative' THEN -1
            ELSE 0
          END
        ) AS avg_sentiment_score,
        AVG(
          CASE
            WHEN carrier_quoted_rate IS NOT NULL
             AND loadboard_rate IS NOT NULL
             AND loadboard_rate > 0
            THEN (carrier_quoted_rate - loadboard_rate) / loadboard_rate
          END
        ) AS avg_quote_premium_pct,
        AVG(
          CASE
            WHEN carrier_quoted_rate IS NOT NULL
             AND loadboard_rate IS NOT NULL
             AND loadboard_rate > 0
            THEN
              CASE WHEN carrier_quoted_rate > loadboard_rate * 1.10
                   THEN 1.0 ELSE 0.0 END
          END
        ) AS premium_share_pct,
        MAX(started_at) AS last_called_at,
        (
          SELECT COALESCE(jsonb_agg(s.sentiment ORDER BY s.started_at ASC), '[]'::jsonb)
          FROM (
            SELECT sub.sentiment, sub.started_at
            FROM per_call sub
            WHERE sub.mc_number = per_call.mc_number
            ORDER BY sub.started_at DESC
            LIMIT 5
          ) s
        ) AS sentiment_trend
    FROM per_call
    GROUP BY mc_number
),
ineligible_counts AS (
    SELECT mc_number, COUNT(*) AS ineligible_verifications
    FROM verifications
    WHERE eligible = FALSE
    GROUP BY mc_number
)
SELECT
    a.mc_number,
    (
      SELECT carrier_name
      FROM (
        SELECT v.carrier_name, v.checked_at AS ts, 1 AS source_rank
        FROM verifications v
        WHERE v.mc_number = a.mc_number AND v.carrier_name IS NOT NULL
        UNION ALL
        SELECT c.carrier->>'carrier_name' AS carrier_name,
               c.started_at AS ts,
               2 AS source_rank
        FROM calls c
        WHERE c.carrier->>'mc_number' = a.mc_number
          AND c.carrier->>'carrier_name' IS NOT NULL
      ) names
      ORDER BY source_rank ASC, ts DESC
      LIMIT 1
    ) AS carrier_name,
    a.calls,
    a.conversational_calls,
    a.booked,
    a.dropped,
    a.avg_sentiment_score,
    a.avg_quote_premium_pct,
    a.premium_share_pct,
    a.last_called_at,
    a.sentiment_trend,
    COALESCE(ic.ineligible_verifications, 0) AS ineligible_verifications,
    CASE WHEN a.conversational_calls > 0
         THEN a.booked::float / a.conversational_calls ELSE 0 END AS booking_rate,
    CASE WHEN a.calls > 0
         THEN a.dropped::float / a.calls ELSE 0 END AS drop_rate
FROM agg a
LEFT JOIN ineligible_counts ic ON ic.mc_number = a.mc_number
"""


def _build_flags(row: dict[str, Any]) -> list[str]:
    """Apply the four carrier flags from a per-MC aggregate row.

    Rules (per metrics plan):
      - tire_kicker:  conversational_calls >= 3 AND booked == 0
      - hostage:      conversational_calls >= 3 AND avg_quote_premium_pct > 0.10
                                                 AND premium_share_pct >= 0.7
      - top_repeat:   conversational_calls >= 3 AND booking_rate >= 0.6
      - repeat_ineligible: ineligible_verifications >= 2
    """
    flags: list[str] = []
    conversational = int(row["conversational_calls"])
    booked = int(row["booked"])
    booking_rate = (booked / conversational) if conversational else 0.0
    premium = row.get("avg_quote_premium_pct")
    premium_share = row.get("premium_share_pct")
    ineligible_verifications = int(row.get("ineligible_verifications") or 0)

    if conversational >= 3 and booked == 0:
        flags.append("tire_kicker")
    if (
        conversational >= 3
        and premium is not None
        and premium_share is not None
        and float(premium) > 0.10
        and float(premium_share) >= 0.7
    ):
        flags.append("hostage")
    if conversational >= 3 and booking_rate >= 0.6:
        flags.append("top_repeat")
    if ineligible_verifications >= 2:
        flags.append("repeat_ineligible")
    return flags


def _row_to_carrier_stats_dict(row: dict[str, Any]) -> dict[str, Any]:
    conversational = int(row["conversational_calls"])
    booked = int(row["booked"])
    calls = int(row["calls"])
    dropped = int(row["dropped"])
    booking_rate = round((booked / conversational), 4) if conversational else 0.0
    drop_rate = round((dropped / calls), 4) if calls else 0.0

    sentiment_trend = row.get("sentiment_trend") or []
    code_map = {"Positive": "P", "Neutral": "N", "Negative": "X"}
    trend_codes = [code_map.get(s, "?") for s in sentiment_trend]

    return {
        "mc_number": row["mc_number"],
        "carrier_name": row.get("carrier_name"),
        "calls": calls,
        "conversational_calls": conversational,
        "booked": booked,
        "booking_rate": booking_rate,
        "avg_sentiment_score": (
            round(float(row["avg_sentiment_score"]), 4)
            if row.get("avg_sentiment_score") is not None
            else 0.0
        ),
        "sentiment_trend": trend_codes,
        "avg_quote_premium_pct": (
            round(float(row["avg_quote_premium_pct"]), 4)
            if row.get("avg_quote_premium_pct") is not None
            else None
        ),
        "premium_share_pct": (
            round(float(row["premium_share_pct"]), 4)
            if row.get("premium_share_pct") is not None
            else None
        ),
        "drop_rate": drop_rate,
        "last_called_at": row["last_called_at"],
        "flags": _build_flags(row),
    }


async def fetch_carriers(
    session: AsyncSession,
    *,
    sort: str,
    min_calls: int,
    limit: int,
    cursor: tuple[Any, str] | None,
) -> tuple[list[dict[str, Any]], int]:
    """Return (rows-as-dicts, total) for the per-carrier leaderboard.

    `sort` is validated by the router via Literal[...]. `cursor` is the
    decoded (sort_value, mc_number) tuple from `decode_cursor` (or None).
    Returned list has up to `limit + 1` rows when there's a next page —
    the caller (service layer) slices and re-encodes the cursor.
    """
    order_by = _SORT_CLAUSES.get(sort, _SORT_CLAUSES["calls"])

    where = "WHERE a.calls >= :min_calls"
    params: dict[str, Any] = {"min_calls": min_calls, "limit": limit + 1}

    # Apply cursor as a strict tiebreak on (sort_value, mc_number). The
    # comparison flips per direction: all our sorts are DESC so the next
    # page should yield rows whose value is < cursor_val (or equal but
    # mc_number > cursor_mc).
    if cursor is not None:
        sort_value, last_mc = cursor
        params["cursor_mc"] = last_mc
        col_map = {
            "calls": "a.calls",
            "booking_rate": "a.booking_rate",
            "avg_quote_premium": "a.avg_quote_premium_pct",
            "drop_rate": "a.drop_rate",
        }
        col = col_map.get(sort, "a.calls")
        if sort == "calls":
            params["cursor_val"] = int(sort_value)
        else:
            params["cursor_val"] = float(sort_value) if sort_value is not None else None
        where += (
            f" AND ({col} < :cursor_val " f"OR ({col} = :cursor_val AND a.mc_number > :cursor_mc))"
        )

    final_sql = f"""
SELECT * FROM (
    {_PER_MC_SQL}
) a
{where}
ORDER BY {order_by}
LIMIT :limit
"""

    count_sql = f"""
SELECT COUNT(*) FROM (
    {_PER_MC_SQL}
) a
WHERE a.calls >= :min_calls
"""

    rows = (await session.execute(text(final_sql), params)).mappings().all()
    total_row = (await session.execute(text(count_sql), {"min_calls": min_calls})).scalar_one()

    return [dict(r) for r in rows], int(total_row)


async def fetch_carrier_aggregate(
    session: AsyncSession,
    mc_number: str,
) -> dict[str, Any] | None:
    """Single-MC aggregate. Returns None if no calls exist for the MC."""
    sql = f"""
SELECT * FROM (
    {_PER_MC_SQL}
) a
WHERE a.mc_number = :mc_number
"""
    row = (await session.execute(text(sql), {"mc_number": mc_number})).mappings().first()
    if row is None:
        return None
    return dict(row)


async def fetch_sentiment_timeline(
    session: AsyncSession, mc_number: str, limit: int = 20
) -> list[tuple[datetime, str]]:
    """Last `limit` sentiments for the carrier, oldest→newest."""
    sql = """
    SELECT sentiment, started_at
    FROM (
        SELECT sentiment, started_at
        FROM calls
        WHERE carrier->>'mc_number' = :mc
        ORDER BY started_at DESC
        LIMIT :limit
    ) recent
    ORDER BY started_at ASC
    """
    rows = (await session.execute(text(sql), {"mc": mc_number, "limit": limit})).mappings().all()
    return [(r["started_at"], r["sentiment"]) for r in rows]
