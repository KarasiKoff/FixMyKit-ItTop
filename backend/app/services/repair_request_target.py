"""Валидация цели заявки: устройство или кабинет (ровно одно)."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.app.models.enums import RequestStatus
from backend.app.repositories.audience_repository import AudienceRepository
from backend.app.repositories.device_repository import DeviceRepository
from backend.app.repositories.repair_request_repository import RepairRequestRepository

ACTIVE_STATUSES = (
    RequestStatus.OPEN,
    RequestStatus.IN_PROGRESS,
    RequestStatus.NEEDS_INFO,
)


def parse_repair_target(
    *,
    device_id: UUID | None,
    audience_id: UUID | None,
) -> tuple[UUID | None, UUID | None]:
    has_device = device_id is not None
    has_audience = audience_id is not None
    if has_device == has_audience:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="device_id_xor_audience_id_required",
        )
    return device_id, audience_id


def ensure_device_exists(db: Session, device_id: UUID) -> None:
    if not DeviceRepository(db).exists(device_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="device_not_found"
        )


def ensure_audience_exists(db: Session, audience_id: UUID) -> None:
    if not AudienceRepository(db).exists(audience_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="audience_not_found"
        )


def ensure_target_exists(
    db: Session, device_id: UUID | None, audience_id: UUID | None
) -> None:
    if device_id is not None:
        ensure_device_exists(db, device_id)
    else:
        ensure_audience_exists(db, audience_id)  # type: ignore[arg-type]


def ensure_no_active_request(
    db: Session,
    *,
    device_id: UUID | None = None,
    audience_id: UUID | None = None,
) -> None:
    if RepairRequestRepository(db).has_active_for_target(
        device_id=device_id,
        audience_id=audience_id,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="active_request_exists"
        )
