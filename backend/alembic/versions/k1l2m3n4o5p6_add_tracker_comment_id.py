"""add tracker_comment_id to repair_request_comments

Revision ID: k1l2m3n4o5p6
Revises: j0k1l2m3n4o5
Create Date: 2026-06-02 00:42:43.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "k1l2m3n4o5p6"
down_revision = "j0k1l2m3n4o5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "repair_request_comments",
        sa.Column("tracker_comment_id", sa.String(length=64), nullable=True),
    )
    op.create_index(
        "ix_repair_request_comments_tracker_comment_id",
        "repair_request_comments",
        ["tracker_comment_id"],
        unique=False,
    )
    op.create_index(
        "uq_repair_request_comments_tracker_comment",
        "repair_request_comments",
        ["repair_request_id", "tracker_comment_id"],
        unique=True,
        postgresql_where=sa.text("tracker_comment_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_repair_request_comments_tracker_comment",
        table_name="repair_request_comments",
    )
    op.drop_index(
        "ix_repair_request_comments_tracker_comment_id",
        table_name="repair_request_comments",
    )
    op.drop_column("repair_request_comments", "tracker_comment_id")
