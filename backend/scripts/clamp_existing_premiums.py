"""One-shot cleanup: clamp any persisted call where final_agreed_rate
exceeds loadboard_rate * 1.10 down to the ceiling. Mirrors the new
defensive lint in ingest_call. Run after deploying the lint to back-fill
historical bad data.

Usage:
    cd backend
    DATABASE_URL=postgres://... uv run python scripts/clamp_existing_premiums.py
"""

from __future__ import annotations

import asyncio
import os
import sys

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    print("ERROR: set DATABASE_URL in env", file=sys.stderr)
    sys.exit(2)

# asyncpg driver shim for `postgres://` URLs
ASYNC_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1).replace(
    "postgresql://", "postgresql+asyncpg://", 1
)

CEILING_MULTIPLIER = 1.10


PREVIEW_SQL = """
SELECT
    call_id,
    carrier->>'mc_number' AS mc,
    load->>'load_id' AS load_id,
    (load->>'loadboard_rate')::numeric AS listed,
    (negotiation->>'final_agreed_rate')::numeric AS final,
    ROUND(
        ((negotiation->>'final_agreed_rate')::numeric
         - (load->>'loadboard_rate')::numeric)
        / NULLIF((load->>'loadboard_rate')::numeric, 0) * 100,
        2
    ) AS premium_pct
FROM calls
WHERE outcome = 'Booked'
  AND (negotiation->>'final_agreed_rate') IS NOT NULL
  AND (load->>'loadboard_rate') IS NOT NULL
  AND (load->>'loadboard_rate')::numeric > 0
  AND (negotiation->>'final_agreed_rate')::numeric
      > (load->>'loadboard_rate')::numeric * :mult
ORDER BY premium_pct DESC
"""


UPDATE_SQL = """
UPDATE calls
SET negotiation = jsonb_set(
        negotiation,
        '{final_agreed_rate}',
        to_jsonb(ROUND((load->>'loadboard_rate')::numeric * :mult, 2))
    ),
    updated_at = NOW()
WHERE outcome = 'Booked'
  AND (negotiation->>'final_agreed_rate') IS NOT NULL
  AND (load->>'loadboard_rate') IS NOT NULL
  AND (load->>'loadboard_rate')::numeric > 0
  AND (negotiation->>'final_agreed_rate')::numeric
      > (load->>'loadboard_rate')::numeric * :mult
RETURNING call_id
"""


async def main() -> None:
    engine = create_async_engine(ASYNC_URL)
    async with engine.connect() as conn:
        rows = (
            (await conn.execute(text(PREVIEW_SQL), {"mult": CEILING_MULTIPLIER})).mappings().all()
        )

        if not rows:
            print("No calls above ceiling. Nothing to clamp.")
            await engine.dispose()
            return

        print(f"Found {len(rows)} call(s) with final_agreed_rate above ceiling:")
        for r in rows:
            print(
                f"  - {r['call_id']:30}  MC {r['mc']:>10}  {r['load_id']:>8}  "
                f"listed=${r['listed']:>8.2f}  final=${r['final']:>8.2f}  "
                f"premium={r['premium_pct']:>6.2f}%"
            )

        confirm = input("\nClamp these to ceiling? [y/N]: ").strip().lower()
        if confirm != "y":
            print("Aborted.")
            await engine.dispose()
            return

        async with conn.begin():
            updated = (
                (await conn.execute(text(UPDATE_SQL), {"mult": CEILING_MULTIPLIER})).scalars().all()
            )

        print(f"Clamped {len(updated)} call(s).")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
