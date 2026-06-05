"""Операции CRUD устройств для HTTP-слоя (тонкие роуты)."""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.models.device import Device as DeviceModel
from backend.app.models.enums import RepairStatus
from backend.app.queries.device_list_query import DeviceSortBy, fetch_devices_page
from backend.app.repositories.device_repository import (
    DeviceRepository,
    device_base_query,
)
from backend.app.repositories.repair_history_repository import RepairHistoryRepository
from backend.app.schemas.device import (
    Device,
    DeviceCreate,
    DeviceHistoryResponse,
    DeviceListResponse,
    DeviceQrResponse,
    DeviceUpdate,
)
from backend.app.schemas.repair_history import RepairHistoryResponse
from backend.app.services.device_subcategory_validation import (
    validate_device_subcategory,
)
from backend.app.services.repair_history_service import add_repair_history

DEVICE_SORT_FIELDS: set[str] = {
    "inventory_number",
    "name",
    "category_name",
    "subcategory_name",
    "audience_name",
    "responsible_name",
    "repair_status",
}
DEVICE_SUGGEST_FIELDS: set[str] = {
    "inventory_number",
    "name",
    "category",
    "room",
    "responsible",
}


def normalize_note(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped if stripped else None


def resolved_category_subcategory(
    device: DeviceModel,
    patch_data: dict,
) -> tuple[UUID | None, UUID | None]:
    category_id = (
        patch_data["category_id"] if "category_id" in patch_data else device.category_id
    )
    if category_id is None:
        return None, None
    if "subcategory_id" in patch_data:
        subcategory_id = patch_data["subcategory_id"]
    elif (
        "category_id" in patch_data and patch_data["category_id"] != device.category_id
    ):
        subcategory_id = None
    else:
        subcategory_id = device.subcategory_id
    return category_id, subcategory_id


def list_devices(
    db: Session,
    *,
    inventory_number: str | None,
    name: str | None,
    category: str | None,
    room: str | None,
    responsible: str | None,
    repair_status: RepairStatus | None,
    sort_by: DeviceSortBy,
    sort_dir: Literal["asc", "desc"],
    limit: int,
    offset: int,
) -> DeviceListResponse:
    if sort_by not in DEVICE_SORT_FIELDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_sort_by"
        )

    items, total = fetch_devices_page(
        db,
        inventory_number=inventory_number,
        name=name,
        category=category,
        room=room,
        responsible=responsible,
        repair_status=repair_status,
        sort_by=sort_by,
        sort_dir=sort_dir,
        limit=limit,
        offset=offset,
    )
    return DeviceListResponse(
        items=[Device.model_validate(item) for item in items], total=total
    )


def create_device(db: Session, payload: DeviceCreate) -> Device:
    data = payload.model_dump()
    data["note"] = normalize_note(data.get("note"))
    validate_device_subcategory(
        db,
        category_id=data.get("category_id"),
        subcategory_id=data.get("subcategory_id"),
    )
    device = DeviceModel(**data)
    repo = DeviceRepository(db)
    try:
        repo.save_new(device)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="inventory_number_exists"
        ) from exc
    refreshed = repo.get_with_relations(device.id)
    if refreshed is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="device_not_found"
        )
    return Device.model_validate(refreshed)


def get_device(db: Session, device_id: UUID) -> Device:
    device = DeviceRepository(db).get_with_relations(device_id)
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="device_not_found"
        )
    return Device.model_validate(device)


def patch_device(db: Session, device_id: UUID, payload: DeviceUpdate) -> Device:
    repo = DeviceRepository(db)
    device = repo.get_by_id(device_id)
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="device_not_found"
        )

    patch_data = payload.model_dump(exclude_unset=True)
    if "note" in patch_data:
        patch_data["note"] = normalize_note(patch_data["note"])

    category_id, subcategory_id = resolved_category_subcategory(device, patch_data)
    validate_device_subcategory(
        db, category_id=category_id, subcategory_id=subcategory_id
    )

    old_repair_status = device.repair_status
    for field, value in patch_data.items():
        setattr(device, field, value)
    if "category_id" in patch_data:
        if patch_data["category_id"] is None:
            device.subcategory_id = None
        elif (
            "subcategory_id" not in patch_data
            and patch_data["category_id"] != device.category_id
        ):
            device.subcategory_id = None

    if "repair_status" in patch_data and device.repair_status != old_repair_status:
        add_repair_history(
            db,
            device_id=device.id,
            repair_request_id=None,
            old_status=old_repair_status,
            new_status=device.repair_status,
            note="Изменение статуса ремонта устройства",
        )

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="inventory_number_exists"
        ) from exc

    refreshed = device_base_query(db).filter(DeviceModel.id == device_id).first()
    if refreshed is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="device_not_found"
        )
    return Device.model_validate(refreshed)


def delete_device(db: Session, device_id: UUID) -> None:
    repo = DeviceRepository(db)
    repo.get_or_404(device_id)
    repo.delete_with_related(device_id)
    db.commit()


def device_qr(db: Session, device_id: UUID) -> DeviceQrResponse:
    DeviceRepository(db).get_or_404(device_id)
    base = settings.server.public_frontend_base_url.rstrip("/")
    return DeviceQrResponse(
        device_id=device_id, url=f"{base}/device/{device_id}/public"
    )


def device_history(db: Session, device_id: UUID) -> DeviceHistoryResponse:
    DeviceRepository(db).get_or_404(device_id)
    rows = RepairHistoryRepository(db).list_for_device(device_id)
    items = [
        RepairHistoryResponse(
            id=row.id,
            device_id=row.device_id,
            repair_request_id=row.repair_request_id,
            old_status=row.old_status,
            new_status=row.new_status,
            note=row.note,
            created_at=row.created_at,
            tracker_ticket_key=row.repair_request.tracker_ticket_key
            if row.repair_request
            else None,
            tracker_ticket_url=row.repair_request.tracker_ticket_url
            if row.repair_request
            else None,
        )
        for row in rows
    ]
    return DeviceHistoryResponse(items=items)
