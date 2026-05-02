"""analytics_indexes

Revision ID: 5d6194941b1d
Revises: 9cc15ee639a7
Create Date: 2026-05-02 11:21:20.701915

Adds expression and column indexes used by the new analytics endpoints
(`/metrics/carriers`, `/metrics/lanes`, `/metrics/negotiation`, plus the
extended `/metrics/summary`). All written as raw SQL with `IF NOT EXISTS`
because:
  - autogenerate doesn't pick up JSONB expression indexes;
  - the migration must be safely re-runnable on environments where some
    of these indexes already exist (Railway prod takeover case).

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5d6194941b1d"
down_revision: Union[str, Sequence[str], None] = "9cc15ee639a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_INDEXES: tuple[tuple[str, str], ...] = (
    (
        "ix_calls_started_at",
        "CREATE INDEX IF NOT EXISTS ix_calls_started_at ON calls(started_at)",
    ),
    (
        "ix_calls_carrier_mc",
        "CREATE INDEX IF NOT EXISTS ix_calls_carrier_mc ON calls((carrier->>'mc_number'))",
    ),
    (
        "ix_calls_lane",
        "CREATE INDEX IF NOT EXISTS ix_calls_lane "
        "ON calls((load->>'origin'), (load->>'destination'))",
    ),
    (
        "ix_negotiation_rounds_round",
        "CREATE INDEX IF NOT EXISTS ix_negotiation_rounds_round ON negotiation_rounds(round)",
    ),
    (
        "ix_calls_outcome_started",
        "CREATE INDEX IF NOT EXISTS ix_calls_outcome_started " "ON calls(outcome, started_at DESC)",
    ),
)


def upgrade() -> None:
    """Create analytics indexes (idempotent)."""
    for _, ddl in _INDEXES:
        op.execute(ddl)


def downgrade() -> None:
    """Drop analytics indexes (idempotent)."""
    for name, _ in _INDEXES:
        op.execute(f"DROP INDEX IF EXISTS {name}")
