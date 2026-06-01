"""add map_door_edge to audience

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-05-21 22:00:00.000000
"""

import sqlalchemy as sa
from alembic import op

revision = "f6a7b8c9d0e1"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "audience",
        sa.Column("map_door_edge", sa.String(length=8), nullable=False, server_default="bottom"),
    )
    op.alter_column("audience", "map_door_edge", server_default=None)


def downgrade() -> None:
    op.drop_column("audience", "map_door_edge")
