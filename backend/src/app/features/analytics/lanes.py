"""SQL for the per-lane leaderboard.

Granularity toggle:
  - city  → group by `(load->>'origin', load->>'destination')` directly.
  - state → group by `split_part(origin, ', ', 2)` so "Atlanta, GA" → "GA".
            If the split returns empty (no comma in the string), fall back
            to the raw string so noisy data doesn't get bucketed under "".

Window:
  - 7d / 14d / 30d / all. The "previous window" used for the heat trend is
    the same length immediately preceding the current window.
  - For 'all', `calls_prev_window` is always 0 → the trend is always 'flat'.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

_WINDOW_DAYS: dict[str, int | None] = {
    "7d": 7,
    "14d": 14,
    "30d": 30,
    "all": None,
}


def _window_bounds(window: str) -> tuple[datetime | None, datetime | None]:
    """Return (current_window_start, prev_window_start). Both may be None for 'all'."""
    days = _WINDOW_DAYS.get(window, 14)
    if days is None:
        return None, None
    now = datetime.now(timezone.utc)
    current_start = now - timedelta(days=days)
    prev_start = now - timedelta(days=days * 2)
    return current_start, prev_start


def _origin_expr(granularity: str) -> str:
    if granularity == "state":
        # split_part returns '' when the delimiter isn't found. Fall back
        # to the full string so we don't collapse all unparsed lanes into
        # the same bucket.
        return (
            "CASE WHEN split_part(c.load->>'origin', ', ', 2) = '' "
            "THEN c.load->>'origin' "
            "ELSE split_part(c.load->>'origin', ', ', 2) END"
        )
    return "c.load->>'origin'"


def _destination_expr(granularity: str) -> str:
    if granularity == "state":
        return (
            "CASE WHEN split_part(c.load->>'destination', ', ', 2) = '' "
            "THEN c.load->>'destination' "
            "ELSE split_part(c.load->>'destination', ', ', 2) END"
        )
    return "c.load->>'destination'"


async def fetch_lanes(
    session: AsyncSession,
    *,
    granularity: str,
    window: str,
    min_calls: int,
    limit: int,
) -> list[dict[str, Any]]:
    origin_expr = _origin_expr(granularity)
    dest_expr = _destination_expr(granularity)
    current_start, prev_start = _window_bounds(window)

    # Equipment mix is built as a JSONB object via jsonb_object_agg over a
    # nested aggregation. Postgres can do it inline, but readability wins:
    # a single per-(lane,equipment) count subquery, then aggregated up.
    sql = f"""
WITH lane_calls AS (
    SELECT
        {origin_expr} AS origin,
        {dest_expr} AS destination,
        c.outcome,
        c.started_at,
        c.load->>'equipment_type' AS equipment_type,
        (c.load->>'loadboard_rate')::numeric AS loadboard_rate,
        (c.negotiation->>'final_agreed_rate')::numeric AS final_agreed_rate
    FROM calls c
    WHERE c.load->>'origin' IS NOT NULL
      AND c.load->>'destination' IS NOT NULL
),
agg AS (
    SELECT
        origin,
        destination,
        COUNT(*) FILTER (
            WHERE CAST(:current_start AS TIMESTAMPTZ) IS NULL OR started_at >= CAST(:current_start AS TIMESTAMPTZ)
        ) AS calls,
        COUNT(*) FILTER (
            WHERE outcome = 'Booked'
              AND (CAST(:current_start AS TIMESTAMPTZ) IS NULL OR started_at >= CAST(:current_start AS TIMESTAMPTZ))
        ) AS booked,
        AVG(loadboard_rate) FILTER (
            WHERE CAST(:current_start AS TIMESTAMPTZ) IS NULL OR started_at >= CAST(:current_start AS TIMESTAMPTZ)
        ) AS avg_loadboard_rate,
        AVG(final_agreed_rate) FILTER (
            WHERE outcome = 'Booked'
              AND (CAST(:current_start AS TIMESTAMPTZ) IS NULL OR started_at >= CAST(:current_start AS TIMESTAMPTZ))
        ) AS avg_agreed_rate,
        AVG(
          CASE
            WHEN outcome = 'Booked'
             AND loadboard_rate IS NOT NULL
             AND loadboard_rate > 0
             AND final_agreed_rate IS NOT NULL
             AND (CAST(:current_start AS TIMESTAMPTZ) IS NULL OR started_at >= CAST(:current_start AS TIMESTAMPTZ))
            THEN (final_agreed_rate - loadboard_rate) / loadboard_rate
          END
        ) AS avg_margin_vs_lb_pct,
        COUNT(*) FILTER (
            WHERE CAST(:prev_start AS TIMESTAMPTZ) IS NOT NULL
              AND started_at >= CAST(:prev_start AS TIMESTAMPTZ)
              AND started_at < CAST(:current_start AS TIMESTAMPTZ)
        ) AS calls_prev_window
    FROM lane_calls
    GROUP BY origin, destination
),
equipment_mix AS (
    SELECT
        origin,
        destination,
        jsonb_object_agg(
          COALESCE(equipment_type, 'Unknown'),
          eq_count
        ) AS equipment_mix
    FROM (
        SELECT
            origin,
            destination,
            COALESCE(equipment_type, 'Unknown') AS equipment_type,
            COUNT(*) AS eq_count
        FROM lane_calls
        WHERE CAST(:current_start AS TIMESTAMPTZ) IS NULL OR started_at >= CAST(:current_start AS TIMESTAMPTZ)
        GROUP BY origin, destination, COALESCE(equipment_type, 'Unknown')
    ) per_eq
    GROUP BY origin, destination
)
SELECT
    a.origin,
    a.destination,
    a.calls,
    a.booked,
    a.avg_loadboard_rate,
    a.avg_agreed_rate,
    a.avg_margin_vs_lb_pct,
    a.calls_prev_window,
    COALESCE(em.equipment_mix, '{{}}'::jsonb) AS equipment_mix
FROM agg a
LEFT JOIN equipment_mix em ON em.origin = a.origin AND em.destination = a.destination
WHERE a.calls >= :min_calls
ORDER BY a.calls DESC, a.booked DESC
LIMIT :limit
"""

    rows = (
        (
            await session.execute(
                text(sql),
                {
                    "current_start": current_start,
                    "prev_start": prev_start,
                    "min_calls": min_calls,
                    "limit": limit,
                },
            )
        )
        .mappings()
        .all()
    )

    out: list[dict[str, Any]] = []
    for r in rows:
        calls = int(r["calls"])
        booked = int(r["booked"])
        prev = int(r["calls_prev_window"])
        if prev == 0:
            # If there's nothing to compare against, "heating" overstates;
            # the metric plan only flags heating when prev > 0 and growth
            # ≥ +25%. With prev=0 we can't compute a ratio meaningfully,
            # so default to flat. Window='all' also lands here by design.
            trend = "flat"
        else:
            ratio = calls / prev
            if ratio >= 1.25:
                trend = "heating"
            elif ratio <= 0.75:
                trend = "cooling"
            else:
                trend = "flat"

        avg_lb = r["avg_loadboard_rate"]
        avg_agreed = r["avg_agreed_rate"]
        avg_margin = r["avg_margin_vs_lb_pct"]
        equipment_mix = r["equipment_mix"] or {}
        out.append(
            {
                "origin": r["origin"],
                "destination": r["destination"],
                "calls": calls,
                "booked": booked,
                "booking_rate": round((booked / calls), 4) if calls else 0.0,
                "avg_loadboard_rate": (round(float(avg_lb), 2) if avg_lb is not None else None),
                "avg_agreed_rate": (
                    round(float(avg_agreed), 2) if avg_agreed is not None else None
                ),
                "avg_margin_vs_lb_pct": (
                    round(float(avg_margin), 4) if avg_margin is not None else None
                ),
                "equipment_mix": {k: int(v) for k, v in equipment_mix.items()},
                "calls_prev_window": prev,
                "trend": trend,
            }
        )

    return out
