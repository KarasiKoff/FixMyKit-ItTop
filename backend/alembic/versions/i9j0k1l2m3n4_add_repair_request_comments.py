"""add repair_request_comments

Revision ID: i9j0k1l2m3n4
Revises: h7i8j9k0l1m2
Create Date: 2026-06-01 23:31:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "i9j0k1l2m3n4"
down_revision = "h7i8j9k0l1m2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "repair_request_comments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("repair_request_id", sa.Uuid(), nullable=False),
        sa.Column("author_user_id", sa.Uuid(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "tracker_synced", sa.Boolean(), nullable=False, server_default="true"
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["repair_request_id"], ["repair_requests.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["author_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_repair_request_comments_request_id",
        "repair_request_comments",
        ["repair_request_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_repair_request_comments_request_id", table_name="repair_request_comments"
    )
    op.drop_table("repair_request_comments")
