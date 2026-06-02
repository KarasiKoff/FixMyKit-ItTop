"""add tracker_status_sync_pending to repair_requests

Revision ID: n4o5p6q7r8s0
Revises: k1l2m3n4o5p6
Create Date: 2026-06-02 16:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "n4o5p6q7r8s0"
down_revision = "k1l2m3n4o5p6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "repair_requests",
        sa.Column(
            "tracker_status_sync_pending",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )


def downgrade() -> None:
    op.drop_column("repair_requests", "tracker_status_sync_pending")
