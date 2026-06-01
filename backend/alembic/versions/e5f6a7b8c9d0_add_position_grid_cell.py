"""add grid_col grid_row to room_device_positions

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-05-21 20:00:00.000000
"""

import sqlalchemy as sa
from alembic import op

revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("room_device_positions", sa.Column("grid_col", sa.Integer(), nullable=True))
    op.add_column("room_device_positions", sa.Column("grid_row", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("room_device_positions", "grid_row")
    op.drop_column("room_device_positions", "grid_col")
