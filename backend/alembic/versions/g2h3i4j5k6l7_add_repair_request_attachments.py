"""add repair request attachment metadata

Revision ID: g2h3i4j5k6l7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-20 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "g2h3i4j5k6l7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None

attachments_sync_status = sa.Enum(
    "none",
    "partial",
    "complete",
    name="attachments_sync_status",
    create_type=True,
)


def upgrade() -> None:
    attachments_sync_status.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "repair_requests",
        sa.Column("has_attachments", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "repair_requests",
        sa.Column(
            "attachments_sync_status",
            attachments_sync_status,
            nullable=False,
            server_default="none",
        ),
    )
    op.add_column(
        "repair_requests",
        sa.Column("attachments_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "repair_requests",
        sa.Column("attachments_synced_count", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("repair_requests", "attachments_synced_count")
    op.drop_column("repair_requests", "attachments_count")
    op.drop_column("repair_requests", "attachments_sync_status")
    op.drop_column("repair_requests", "has_attachments")
    attachments_sync_status.drop(op.get_bind(), checkfirst=True)
