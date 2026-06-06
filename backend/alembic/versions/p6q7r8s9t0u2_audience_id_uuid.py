"""audience: integer id -> UUID (как у devices)

Revision ID: p6q7r8s9t0u2
Revises: o5p6q7r8s9t1
Create Date: 2026-06-02 20:57:00.000000
"""

from alembic import op

revision = "p6q7r8s9t0u2"
down_revision = "o5p6q7r8s9t1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE audience ADD COLUMN id_uuid UUID")
    op.execute("UPDATE audience SET id_uuid = gen_random_uuid() WHERE id_uuid IS NULL")

    op.execute("ALTER TABLE devices ADD COLUMN audience_id_uuid UUID")
    op.execute(
        """
        UPDATE devices d
        SET audience_id_uuid = a.id_uuid
        FROM audience a
        WHERE d.audience_id = a.id
        """
    )
    op.drop_constraint("devices_audience_id_fkey", "devices", type_="foreignkey")
    op.drop_column("devices", "audience_id")
    op.alter_column("devices", "audience_id_uuid", new_column_name="audience_id")

    op.execute("ALTER TABLE repair_requests ADD COLUMN audience_id_uuid UUID")
    op.execute(
        """
        UPDATE repair_requests r
        SET audience_id_uuid = a.id_uuid
        FROM audience a
        WHERE r.audience_id = a.id
        """
    )
    op.drop_constraint(
        "fk_repair_requests_audience_id", "repair_requests", type_="foreignkey"
    )
    op.drop_column("repair_requests", "audience_id")
    op.alter_column(
        "repair_requests", "audience_id_uuid", new_column_name="audience_id"
    )

    op.execute("ALTER TABLE room_device_positions ADD COLUMN audience_id_uuid UUID")
    op.execute(
        """
        UPDATE room_device_positions p
        SET audience_id_uuid = a.id_uuid
        FROM audience a
        WHERE p.audience_id = a.id
        """
    )
    op.drop_constraint(
        "room_device_positions_audience_id_fkey",
        "room_device_positions",
        type_="foreignkey",
    )
    op.drop_index(
        "ix_room_device_positions_audience_id", table_name="room_device_positions"
    )
    op.drop_constraint(
        "uq_room_device_position", "room_device_positions", type_="unique"
    )
    op.drop_column("room_device_positions", "audience_id")
    op.alter_column(
        "room_device_positions", "audience_id_uuid", new_column_name="audience_id"
    )

    op.drop_constraint("audience_pkey", "audience", type_="primary")
    op.drop_column("audience", "id")
    op.alter_column("audience", "id_uuid", new_column_name="id", nullable=False)
    op.create_primary_key("audience_pkey", "audience", ["id"])

    op.create_foreign_key(
        "devices_audience_id_fkey",
        "devices",
        "audience",
        ["audience_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_repair_requests_audience_id",
        "repair_requests",
        "audience",
        ["audience_id"],
        ["id"],
    )
    op.create_foreign_key(
        "room_device_positions_audience_id_fkey",
        "room_device_positions",
        "audience",
        ["audience_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_unique_constraint(
        "uq_room_device_position", "room_device_positions", ["audience_id", "device_id"]
    )
    op.create_index(
        "ix_room_device_positions_audience_id", "room_device_positions", ["audience_id"]
    )


def downgrade() -> None:
    raise NotImplementedError("audience UUID downgrade not supported")
