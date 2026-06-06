"""Позиции устройств на карте кабинета."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session, defer, joinedload

from backend.app.models.category import Category
from backend.app.models.device import Device
from backend.app.models.room_device_position import RoomDevicePosition


class RoomMapRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def fetch_map_rows(
        self,
        audience_id: UUID,
    ) -> list[tuple[RoomDevicePosition, Device, Category | None]]:
        return (
            self._db.query(RoomDevicePosition, Device, Category)
            .join(Device, RoomDevicePosition.device_id == Device.id)
            .outerjoin(Category, Device.category_id == Category.id)
            .options(defer(Category.icon_data))
            .filter(
                RoomDevicePosition.audience_id == audience_id,
                Device.audience_id == audience_id,
            )
            .all()
        )

    def list_devices_in_audience(self, audience_id: UUID) -> list[Device]:
        return (
            self._db.query(Device)
            .options(
                joinedload(Device.category).load_only(
                    Category.id,
                    Category.name,
                    Category.icon_mime,
                ),
            )
            .filter(Device.audience_id == audience_id)
            .order_by(Device.name)
            .all()
        )

    def placed_device_ids(self, audience_id: UUID) -> set[UUID]:
        rows = (
            self._db.query(RoomDevicePosition.device_id)
            .filter(RoomDevicePosition.audience_id == audience_id)
            .all()
        )
        return {row[0] for row in rows}

    def count_devices_in_audience(
        self, device_ids: set[UUID], audience_id: UUID
    ) -> int:
        if not device_ids:
            return 0
        return (
            self._db.query(Device)
            .filter(
                Device.id.in_(device_ids),
                Device.audience_id == audience_id,
            )
            .count()
        )

    def replace_positions(
        self,
        audience_id: UUID,
        positions: list[RoomDevicePosition],
    ) -> None:
        self._db.query(RoomDevicePosition).filter(
            RoomDevicePosition.audience_id == audience_id,
        ).delete(synchronize_session=False)
        for pos in positions:
            self._db.add(pos)
