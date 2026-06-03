"""Валидация цели заявки: устройство или кабинет (ровно одно)."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.app.models.audience import Audience
from backend.app.models.device import Device
from backend.app.models.enums import RequestStatus
from backend.app.models.repair_request import RepairRequest

ACTIVE_STATUSES = (RequestStatus.OPEN, RequestStatus.IN_PROGRESS)


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
    if db.query(Device.id).filter(Device.id == device_id).first() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="device_not_found"
        )


def ensure_audience_exists(db: Session, audience_id: UUID) -> None:
    if db.query(Audience.id).filter(Audience.id == audience_id).first() is None:
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
    q = db.query(RepairRequest.id).filter(RepairRequest.status.in_(ACTIVE_STATUSES))
    if device_id is not None:
        q = q.filter(RepairRequest.device_id == device_id)
    elif audience_id is not None:
        q = q.filter(RepairRequest.audience_id == audience_id)
    else:
        return

    if q.first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="active_request_exists"
        )
