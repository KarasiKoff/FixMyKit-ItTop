"""add room_device_positions table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-19 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'room_device_positions',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('audience_id', sa.Integer(), nullable=False),
        sa.Column('device_id', sa.Uuid(), nullable=False),
        sa.Column('x_pct', sa.Float(), nullable=False),
        sa.Column('y_pct', sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(['audience_id'], ['audience.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('audience_id', 'device_id', name='uq_room_device_position'),
    )
    op.create_index('ix_room_device_positions_audience_id', 'room_device_positions', ['audience_id'])


def downgrade() -> None:
    op.drop_index('ix_room_device_positions_audience_id', table_name='room_device_positions')
    op.drop_table('room_device_positions')
