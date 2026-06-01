"""add audience map grid columns and rows

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-05-21 18:00:00.000000
"""

import sqlalchemy as sa
from alembic import op

revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "audience",
        sa.Column("map_grid_cols", sa.Integer(), nullable=False, server_default="4"),
    )
    op.add_column(
        "audience",
        sa.Column("map_grid_rows", sa.Integer(), nullable=False, server_default="4"),
    )
    op.alter_column("audience", "map_grid_cols", server_default=None)
    op.alter_column("audience", "map_grid_rows", server_default=None)


def downgrade() -> None:
    op.drop_column("audience", "map_grid_rows")
    op.drop_column("audience", "map_grid_cols")
