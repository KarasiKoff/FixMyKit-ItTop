"""add audience table and device audience link

Revision ID: f1a2b3c4d5e6
Revises: baf83bbd2dfc
Create Date: 2026-05-13 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f1a2b3c4d5e6'
down_revision = 'baf83bbd2dfc'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'audience',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.UniqueConstraint('name'),
    )
    op.add_column('devices', sa.Column('audience_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'devices_audience_id_fkey',
        'devices',
        'audience',
        ['audience_id'],
        ['id'],
    )
    op.execute(
        """
        INSERT INTO audience (name)
        SELECT DISTINCT TRIM(cabinet)
        FROM devices
        WHERE cabinet IS NOT NULL AND TRIM(cabinet) <> ''
        ON CONFLICT (name) DO NOTHING
        """
    )
    op.execute(
        """
        UPDATE devices
        SET audience_id = audience.id
        FROM audience
        WHERE TRIM(devices.cabinet) = audience.name
        """
    )
    op.drop_column('devices', 'cabinet')


def downgrade() -> None:
    op.add_column('devices', sa.Column('cabinet', sa.String(), nullable=True))
    op.execute(
        """
        UPDATE devices
        SET cabinet = audience.name
        FROM audience
        WHERE devices.audience_id = audience.id
        """
    )
    op.drop_constraint('devices_audience_id_fkey', 'devices', type_='foreignkey')
    op.drop_column('devices', 'audience_id')
    op.drop_table('audience')
