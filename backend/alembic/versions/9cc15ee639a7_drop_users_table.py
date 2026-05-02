"""drop_users_table

Revision ID: 9cc15ee639a7
Revises: c7239d1fc057
Create Date: 2026-05-02 01:31:46.454988

POC simplification: per-user accounts replaced by a single shared
DASHBOARD_PASSWORD env var. The `users` table is no longer used.
Downgrade re-creates it identically to the baseline so rollback works.

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9cc15ee639a7"
down_revision: Union[str, Sequence[str], None] = "c7239d1fc057"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop the users table and its email index."""
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")


def downgrade() -> None:
    """Re-create the users table as it was at the baseline revision."""
    op.create_table(
        "users",
        sa.Column("id", sa.UUID(as_uuid=False), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=512), nullable=False),
        sa.Column("full_name", sa.String(length=256), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
