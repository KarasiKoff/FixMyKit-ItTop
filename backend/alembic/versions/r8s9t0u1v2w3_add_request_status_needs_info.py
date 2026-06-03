"""request_status: значение needs_info (Требуется информация)

Revision ID: r8s9t0u1v2w3
Revises: q7r8s9t0u1v2
Create Date: 2026-06-04 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "r8s9t0u1v2w3"
down_revision = "q7r8s9t0u1v2"
branch_labels = None
depends_on = None


def _request_status_labels(connection) -> list[str]:
    rows = connection.execute(
        sa.text(
            """
            SELECT e.enumlabel
            FROM pg_enum e
            JOIN pg_type t ON e.enumtypid = t.oid
            WHERE t.typname = 'request_status'
            ORDER BY e.enumsortorder
            """
        )
    ).fetchall()
    return [r[0] for r in rows]


def upgrade() -> None:
    conn = op.get_bind()
    labels = _request_status_labels(conn)
    uses_lower = "in_progress" in labels or "open" in labels
    needs_label = "needs_info" if uses_lower else "NEEDS_INFO"
    progress_label = "in_progress" if uses_lower else "IN_PROGRESS"
    needs_info_tracker_label = "Требуется информация"

    with op.get_context().autocommit_block():
        op.execute(
            sa.text(
                f"ALTER TYPE request_status ADD VALUE IF NOT EXISTS '{needs_label}'"
            )
        )

    op.execute(
        f"""
        UPDATE repair_requests
        SET status = '{needs_label}'::request_status
        WHERE status::text = '{progress_label}'
          AND tracker_status_label = '{needs_info_tracker_label}'
        """
    )


def downgrade() -> None:
    conn = op.get_bind()
    labels = _request_status_labels(conn)
    uses_lower = "needs_info" in labels
    needs_label = "needs_info" if uses_lower else "NEEDS_INFO"
    progress_label = "in_progress" if uses_lower else "IN_PROGRESS"

    op.execute(
        f"""
        UPDATE repair_requests
        SET status = '{progress_label}'::request_status
        WHERE status::text = '{needs_label}'
        """
    )
