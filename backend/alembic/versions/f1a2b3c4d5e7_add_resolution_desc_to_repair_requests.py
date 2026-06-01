"""add resolution_desc to repair requests

Revision ID: f1a2b3c4d5e7
Revises: f1a2b3c4d5e6
Create Date: 2026-05-15 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f1a2b3c4d5e7'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('repair_requests', sa.Column('resolution_desc', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('repair_requests', 'resolution_desc')
