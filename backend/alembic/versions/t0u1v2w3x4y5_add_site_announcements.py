"""add site_announcements slots

Revision ID: t0u1v2w3x4y5
Revises: s9t0u1v2w3x4
Create Date: 2026-06-04 1:23:43.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "t0u1v2w3x4y5"
down_revision = "s9t0u1v2w3x4"
branch_labels = None
depends_on = None

# create_type=False: типы создаём один раз вручную, иначе create_table пытается создать их снова.
announcement_audience = postgresql.ENUM(
    "all",
    "admins_only",
    name="announcement_audience",
    create_type=False,
)
announcement_severity = postgresql.ENUM(
    "info",
    "warning",
    "danger",
    name="announcement_severity",
    create_type=False,
)


def _create_enum_if_missing(bind, name: str, labels: tuple[str, ...]) -> None:
    postgresql.ENUM(*labels, name=name).create(bind, checkfirst=True)


def upgrade() -> None:
    bind = op.get_bind()
    _create_enum_if_missing(bind, "announcement_audience", ("all", "admins_only"))
    _create_enum_if_missing(bind, "announcement_severity", ("info", "warning", "danger"))

    inspector = sa.inspect(bind)
    if "site_announcements" not in inspector.get_table_names():
        op.create_table(
            "site_announcements",
            sa.Column("slot", sa.SmallInteger(), nullable=False),
            sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("message", sa.String(length=500), nullable=False, server_default=""),
            sa.Column("audience", announcement_audience, nullable=False, server_default="all"),
            sa.Column("severity", announcement_severity, nullable=False, server_default="info"),
            sa.Column(
                "updated_at",
                sa.TIMESTAMP(timezone=True),
                nullable=False,
                server_default=sa.func.now(),
            ),
            sa.PrimaryKeyConstraint("slot"),
            sa.CheckConstraint("slot >= 1 AND slot <= 2", name="ck_site_announcements_slot"),
        )

    op.execute(
        sa.text(
            "INSERT INTO site_announcements (slot, is_enabled, message, audience, severity) "
            "VALUES (1, false, '', 'all', 'info'), (2, false, '', 'all', 'info') "
            "ON CONFLICT (slot) DO NOTHING"
        )
    )


def downgrade() -> None:
    op.drop_table("site_announcements")
    bind = op.get_bind()
    postgresql.ENUM(name="announcement_severity").drop(bind, checkfirst=True)
    postgresql.ENUM(name="announcement_audience").drop(bind, checkfirst=True)
