"""add tracker_status_label to repair_requests

Revision ID: j0k1l2m3n4o5
Revises: i9j0k1l2m3n4
Create Date: 2026-06-02 00:37:23.345000
"""

from alembic import op
import sqlalchemy as sa

revision = "j0k1l2m3n4o5"
down_revision = "i9j0k1l2m3n4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "repair_requests",
        sa.Column("tracker_status_label", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("repair_requests", "tracker_status_label")
