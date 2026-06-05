"""site_announcements: updated_by, emoji, dismiss_version

Revision ID: v2w3x4y5z6a7
Revises: u1v2w3x4y5z6
Create Date: 2026-06-04 2:56:32.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "v2w3x4y5z6a7"
down_revision = "u1v2w3x4y5z6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "site_announcements", sa.Column("emoji", sa.String(length=16), nullable=True)
    )
    op.add_column(
        "site_announcements",
        sa.Column("dismiss_version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column(
        "site_announcements", sa.Column("updated_by_user_id", sa.Uuid(), nullable=True)
    )
    op.create_foreign_key(
        "site_announcements_updated_by_user_id_fkey",
        "site_announcements",
        "users",
        ["updated_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "site_announcements_updated_by_user_id_fkey",
        "site_announcements",
        type_="foreignkey",
    )
    op.drop_column("site_announcements", "updated_by_user_id")
    op.drop_column("site_announcements", "dismiss_version")
    op.drop_column("site_announcements", "emoji")
