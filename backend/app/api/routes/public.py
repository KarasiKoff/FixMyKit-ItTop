from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, defer, joinedload

from backend.app.api.deps import get_db
from backend.app.core.config import settings
from backend.app.models.category import Category as CategoryModel
from backend.app.schemas.attachments import AttachmentLimitsResponse
from backend.app.services.attachment_validation import effective_max_attachment_bytes
from backend.app.models.device import Device as DeviceModel
from backend.app.models.enums import RequestStatus
from backend.app.models.repair_request import RepairRequest
from backend.app.schemas.public_device import (
    PublicDeviceResponse,
    PublicRepairRequestItem,
    PublicRepairSummaryResponse,
)

router = APIRouter(prefix="/api/public", tags=["public"])


@router.get("/attachment-limits", response_model=AttachmentLimitsResponse)
def get_attachment_limits() -> AttachmentLimitsResponse:
    """Лимиты вложений из env (для формы создания заявки)."""
    return AttachmentLimitsResponse(
        max_per_request=settings.server.attachment_max_per_request,
        max_bytes=effective_max_attachment_bytes(),
    )


@router.get("/devices/by-inventory", response_model=PublicDeviceResponse)
def get_public_device_by_inventory(
    number: str = Query(..., min_length=1, description="Инвентарный номер (без учёта регистра)"),
    db: Session = Depends(get_db),
) -> PublicDeviceResponse:
    inv = number.strip()
    device = (
        db.query(DeviceModel)
        .options(
            joinedload(DeviceModel.category).defer(CategoryModel.icon_data),
            joinedload(DeviceModel.audience),
        )
        .filter(func.lower(DeviceModel.inventory_number) == inv.lower())
        .first()
    )
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="device_not_found")
    return PublicDeviceResponse.model_validate(device)


@router.get("/devices/{device_id}", response_model=PublicDeviceResponse)
def get_public_device(device_id: UUID, db: Session = Depends(get_db)) -> PublicDeviceResponse:
    device = (
        db.query(DeviceModel)
        .options(
            joinedload(DeviceModel.category).defer(CategoryModel.icon_data),
            joinedload(DeviceModel.audience),
        )
        .filter(DeviceModel.id == device_id)
        .first()
    )
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="device_not_found")
    return PublicDeviceResponse.model_validate(device)


@router.get("/devices/{device_id}/repair-summary", response_model=PublicRepairSummaryResponse)
def get_public_repair_summary(device_id: UUID, db: Session = Depends(get_db)) -> PublicRepairSummaryResponse:
    """Публичная история ремонтов устройства — для гостей после сканирования QR."""
    device = (
        db.query(DeviceModel)
        .options(
            joinedload(DeviceModel.category).defer(CategoryModel.icon_data),
            joinedload(DeviceModel.audience),
        )
        .filter(DeviceModel.id == device_id)
        .first()
    )
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="device_not_found")

    requests = (
        db.query(RepairRequest)
        .filter(RepairRequest.device_id == device_id)
        .order_by(RepairRequest.created_at.desc())
        .all()
    )

    active_request: PublicRepairRequestItem | None = None
    has_unpublished_active = False
    history: list[PublicRepairRequestItem] = []

    for rr in requests:
        if rr.status in (RequestStatus.OPEN, RequestStatus.IN_PROGRESS):
            if rr.is_published:
                active_request = PublicRepairRequestItem(
                    id=rr.id,
                    description=rr.description,
                    status=rr.status,
                    created_at=rr.created_at,
                    closed_at=rr.closed_at,
                    resolution_note=rr.resolution_note,
                    applicant_name=rr.applicant_name,
                )
            else:
                has_unpublished_active = True
        elif rr.status == RequestStatus.CLOSED and rr.is_published:
            history.append(
                PublicRepairRequestItem(
                    id=rr.id,
                    description=rr.description,
                    status=rr.status,
                    created_at=rr.created_at,
                    closed_at=rr.closed_at,
                    resolution_note=rr.resolution_note,
                    applicant_name=rr.applicant_name,
                )
            )

    return PublicRepairSummaryResponse(
        device=PublicDeviceResponse.model_validate(device),
        active_request=active_request,
        has_unpublished_active=has_unpublished_active,
        history=history,
    )
