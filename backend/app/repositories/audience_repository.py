"""Доступ к кабинетам (audiences) в БД."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.app.models.audience import Audience
from backend.app.models.device import Device
from backend.app.repositories.device_repository import DeviceRepository


class AudienceRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def list_all(self, *, name_contains: str | None = None) -> list[Audience]:
        query = self._db.query(Audience)
        if name_contains is not None:
            query = query.filter(Audience.name.ilike(f"%{name_contains}%"))
        return query.order_by(Audience.name).all()

    def get_by_id(self, audience_id: UUID) -> Audience | None:
        return self._db.query(Audience).filter(Audience.id == audience_id).first()

    def get_by_name(self, name: str) -> Audience | None:
        return self._db.query(Audience).filter(Audience.name == name).first()

    def get_by_name_casefold(self, name: str) -> Audience | None:
        room = name.strip()
        return (
            self._db.query(Audience)
            .filter(func.lower(Audience.name) == room.lower())
            .first()
        )

    def exists(self, audience_id: UUID) -> bool:
        return (
            self._db.query(Audience.id).filter(Audience.id == audience_id).first() is not None
        )

    def get_or_404(self, audience_id: UUID) -> Audience:
        audience = self.get_by_id(audience_id)
        if audience is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="audience_not_found",
            )
        return audience

    def list_device_ids(self, audience_id: UUID) -> list[UUID]:
        rows = (
            self._db.query(Device.id).filter(Device.audience_id == audience_id).all()
        )
        return [row[0] for row in rows]

    def delete_devices_for_audience(self, audience_id: UUID) -> None:
        device_repo = DeviceRepository(self._db)
        for device_id in self.list_device_ids(audience_id):
            device_repo.delete_with_related(device_id)

    def count(self) -> int:
        return int(self._db.query(Audience).count())

    def create(self, name: str) -> Audience:
        audience = Audience(name=name)
        self._db.add(audience)
        self._db.commit()
        self._db.refresh(audience)
        return audience

    def delete(self, audience: Audience) -> None:
        self._db.delete(audience)
        self._db.commit()
