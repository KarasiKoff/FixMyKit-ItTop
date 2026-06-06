"""add subcategories table and devices.subcategory_id

Revision ID: r8s9t0u1v2w3
Revises: q7r8s9t0u1v2
Create Date: 2026-06-03 18:01:00.000000
"""

import sqlalchemy as sa
from alembic import op

revision = "r8s9t0u1v2w3"
down_revision = "q7r8s9t0u1v2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "subcategories",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("category_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "category_id", "name", name="uq_subcategories_category_name"
        ),
    )
    op.create_index("ix_subcategories_category_id", "subcategories", ["category_id"])
    op.add_column("devices", sa.Column("subcategory_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_devices_subcategory_id",
        "devices",
        "subcategories",
        ["subcategory_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_devices_subcategory_id", "devices", type_="foreignkey")
    op.drop_column("devices", "subcategory_id")
    op.drop_index("ix_subcategories_category_id", table_name="subcategories")
    op.drop_table("subcategories")
