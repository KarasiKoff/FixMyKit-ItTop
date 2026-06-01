"""add category icon bytes + mime

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-05-20 12:00:00.000000
"""

import sqlalchemy as sa
from alembic import op

revision = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("categories", sa.Column("icon_mime", sa.String(length=128), nullable=True))
    op.add_column("categories", sa.Column("icon_data", sa.LargeBinary(), nullable=True))


def downgrade() -> None:
    op.drop_column("categories", "icon_data")
    op.drop_column("categories", "icon_mime")
