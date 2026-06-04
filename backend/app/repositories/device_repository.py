"""Доступ к устройствам в БД."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Query, Session, defer, joinedload

from backend.app.models.category import Category
from backend.app.models.device import Device
from backend.app.models.repair_history import RepairHistory
from backend.app.models.repair_request import RepairRequest


class DeviceRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def base_query(self) -> Query[Device]:
        return self._db.query(Device).options(
            joinedload(Device.category).defer(Category.icon_data),
            joinedload(Device.subcategory),
            joinedload(Device.audience),
            joinedload(Device.responsible),
        )

    def get_with_relations(self, device_id: UUID) -> Device | None:
        return self.base_query().filter(Device.id == device_id).first()

    def get_by_id(self, device_id: UUID) -> Device | None:
        return self._db.query(Device).filter(Device.id == device_id).first()

    def exists(self, device_id: UUID) -> bool:
        return (
            self._db.query(Device.id).filter(Device.id == device_id).first() is not None
        )

    def get_or_404(self, device_id: UUID, *, with_relations: bool = False) -> Device:
        device = (
            self.get_with_relations(device_id)
            if with_relations
            else self.get_by_id(device_id)
        )
        if device is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="device_not_found",
            )
        return device

    def delete_with_related(self, device_id: UUID) -> None:
        self._db.query(RepairHistory).filter(RepairHistory.device_id == device_id).delete(
            synchronize_session=False,
        )
        self._db.query(RepairRequest).filter(RepairRequest.device_id == device_id).delete(
            synchronize_session=False,
        )
        self._db.query(Device).filter(Device.id == device_id).delete(synchronize_session=False)


def device_base_query(db: Session) -> Query[Device]:
    return DeviceRepository(db).base_query()
