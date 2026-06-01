"""add is_published to repair_requests

Revision ID: a1b2c3d4e5f6
Revises: f1a2b3c4d5e7
Create Date: 2026-05-17 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = 'f1a2b3c4d5e7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'repair_requests',
        sa.Column('is_published', sa.Boolean(), nullable=False, server_default='false'),
    )


def downgrade() -> None:
    op.drop_column('repair_requests', 'is_published')
