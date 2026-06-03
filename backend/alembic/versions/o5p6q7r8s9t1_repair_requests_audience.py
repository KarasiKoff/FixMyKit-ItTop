"""repair requests: optional device_id, audience_id for cabinet-wide tickets

Revision ID: o5p6q7r8s9t1
Revises: n4o5p6q7r8s0
Create Date: 2026-06-02 18:42:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "o5p6q7r8s9t1"
down_revision = "n4o5p6q7r8s0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "repair_requests",
        sa.Column("audience_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_repair_requests_audience_id",
        "repair_requests",
        "audience",
        ["audience_id"],
        ["id"],
    )
    op.alter_column("repair_requests", "device_id", existing_type=sa.Uuid(), nullable=True)
    op.create_check_constraint(
        "ck_repair_requests_device_xor_audience",
        "repair_requests",
        "(device_id IS NOT NULL AND audience_id IS NULL) OR "
        "(device_id IS NULL AND audience_id IS NOT NULL)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_repair_requests_device_xor_audience", "repair_requests", type_="check")
    op.execute(
        "DELETE FROM repair_requests WHERE device_id IS NULL"
    )
    op.alter_column("repair_requests", "device_id", existing_type=sa.Uuid(), nullable=False)
    op.drop_constraint("fk_repair_requests_audience_id", "repair_requests", type_="foreignkey")
    op.drop_column("repair_requests", "audience_id")
