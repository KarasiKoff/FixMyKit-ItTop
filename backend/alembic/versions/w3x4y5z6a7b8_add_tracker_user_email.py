"""users: email для сопоставления с Jira / Yandex Tracker

Revision ID: w3x4y5z6a7b8
Revises: v2w3x4y5z6a7
Create Date: 2026-06-22
"""

from alembic import op
import sqlalchemy as sa

revision = "w3x4y5z6a7b8"
down_revision = "v2w3x4y5z6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("tracker_user_email", sa.String(), nullable=True),
    )
    op.create_index(
        "ix_users_tracker_user_email",
        "users",
        ["tracker_user_email"],
        unique=True,
        postgresql_where=sa.text("tracker_user_email IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_users_tracker_user_email", table_name="users")
    op.drop_column("users", "tracker_user_email")
