"""add device note

Revision ID: o5p6q7r8s9t0
Revises: n4o5p6q7r8s0
Create Date: 2026-06-03 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "o5p6q7r8s9t0"
down_revision = "n4o5p6q7r8s0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("devices", sa.Column("note", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("devices", "note")
