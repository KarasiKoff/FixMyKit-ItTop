from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, defer, joinedload

from backend.app.api.deps import get_db, require_roles
from backend.app.core.config import settings
from backend.app.models.category import Category as CategoryModel
from backend.app.models.device import Device as DeviceModel
from backend.app.models.enums import RepairStatus, RequestStatus, UserRole
from backend.app.models.repair_history import RepairHistory
from backend.app.models.repair_request import RepairRequest
from backend.app.schemas.device import Device, DeviceCreate, DeviceDetail, DeviceHistoryResponse, DeviceListResponse, DeviceQrResponse, DeviceUpdate
from backend.app.schemas.repair_history import RepairHistoryResponse
from backend.app.schemas.suggest import SuggestResponse
from backend.app.services.device_list_query import fetch_devices_page, suggest_devices
from backend.app.services.repair_history_service import add_repair_history

router = APIRouter(prefix="/api/devices", tags=["devices"])

_DEVICE_SORT_FIELDS: set[str] = {
    "inventory_number",
    "name",
    "category_name",
    "audience_name",
    "responsible_name",
    "repair_status",
}
_DEVICE_SUGGEST_FIELDS: set[str] = {"inventory_number", "name", "category", "room", "responsible"}


def _taken_by_sysadmin_for_device(db: Session, device_id: UUID) -> bool:
    request = (
        db.query(RepairRequest)
        .filter(RepairRequest.device_id == device_id, RepairRequest.status != RequestStatus.CLOSED)
        .order_by(RepairRequest.created_at.desc())
        .first()
    )
    return request is not None and request.taken_by_sysadmin_at is not None


def _to_device_detail(db: Session, device: DeviceModel) -> DeviceDetail:
    base = Device.model_validate(device)
    return DeviceDetail(
        **base.model_dump(),
        taken_by_sysadmin=_taken_by_sysadmin_for_device(db, device.id),
    )


def _device_base_query(db: Session):
    return db.query(DeviceModel).options(
        joinedload(DeviceModel.category).defer(CategoryModel.icon_data),
        joinedload(DeviceModel.audience),
        joinedload(DeviceModel.responsible),
    )


def _delete_device_and_related(db: Session, device_id: UUID) -> None:
    db.query(RepairHistory).filter(RepairHistory.device_id == device_id).delete(synchronize_session=False)
    db.query(RepairRequest).filter(RepairRequest.device_id == device_id).delete(synchronize_session=False)
    db.query(DeviceModel).filter(DeviceModel.id == device_id).delete(synchronize_session=False)


@router.get(
    "/suggest",
    response_model=SuggestResponse,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.SYSADMIN))],
)
def device_suggest(
    field: str = Query(...),
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
) -> SuggestResponse:
    if field not in _DEVICE_SUGGEST_FIELDS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_suggest_field")
    return SuggestResponse(items=suggest_devices(db, field, q))


@router.get(
    "",
    response_model=DeviceListResponse,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.SYSADMIN))],
)
def list_devices(
    inventory_number: str | None = Query(default=None),
    name: str | None = Query(default=None),
    category: str | None = Query(default=None),
    room: str | None = Query(default=None),
    responsible: str | None = Query(default=None),
    repair_status: RepairStatus | None = Query(default=None),
    sort_by: str = Query(default="inventory_number"),
    sort_dir: Literal["asc", "desc"] = Query(default="asc"),
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> DeviceListResponse:
    if sort_by not in _DEVICE_SORT_FIELDS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_sort_by")

    items, total = fetch_devices_page(
        db,
        inventory_number=inventory_number,
        name=name,
        category=category,
        room=room,
        responsible=responsible,
        repair_status=repair_status,
        sort_by=sort_by,  # type: ignore[arg-type]
        sort_dir=sort_dir,
        limit=limit,
        offset=offset,
    )
    return DeviceListResponse(items=[Device.model_validate(item) for item in items], total=total)


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=Device,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.SYSADMIN))],
)
def create_device(payload: DeviceCreate, db: Session = Depends(get_db)) -> Device:
    device = DeviceModel(**payload.model_dump())
    db.add(device)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="inventory_number_exists") from exc
    refreshed = _device_base_query(db).filter(DeviceModel.id == device.id).first()
    if refreshed is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="device_not_found")
    return Device.model_validate(refreshed)


@router.get(
    "/{device_id}",
    response_model=DeviceDetail,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.SYSADMIN))],
)
def get_device(device_id: UUID, db: Session = Depends(get_db)) -> DeviceDetail:
    device = _device_base_query(db).filter(DeviceModel.id == device_id).first()
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="device_not_found")
    return _to_device_detail(db, device)


@router.patch(
    "/{device_id}",
    response_model=DeviceDetail,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.SYSADMIN))],
)
def patch_device(device_id: UUID, payload: DeviceUpdate, db: Session = Depends(get_db)) -> DeviceDetail:
    device = db.query(DeviceModel).filter(DeviceModel.id == device_id).first()
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="device_not_found")

    patch_data = payload.model_dump(exclude_unset=True)
    old_repair_status = device.repair_status
    for field, value in patch_data.items():
        setattr(device, field, value)

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
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="inventory_number_exists") from exc

    refreshed = _device_base_query(db).filter(DeviceModel.id == device_id).first()
    if refreshed is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="device_not_found")
    return _to_device_detail(db, refreshed)


@router.delete(
    "/{device_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.SYSADMIN))],
)
def delete_device(device_id: UUID, db: Session = Depends(get_db)) -> None:
    device = db.query(DeviceModel).filter(DeviceModel.id == device_id).first()
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="device_not_found")

    _delete_device_and_related(db, device_id)
    db.commit()


@router.get(
    "/{device_id}/qr",
    response_model=DeviceQrResponse,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.SYSADMIN))],
)
def get_device_qr(device_id: UUID, db: Session = Depends(get_db)) -> DeviceQrResponse:
    exists = db.query(DeviceModel.id).filter(DeviceModel.id == device_id).first()
    if exists is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="device_not_found")
    base = settings.server.public_frontend_base_url.rstrip("/")
    return DeviceQrResponse(device_id=device_id, url=f"{base}/device/{device_id}/public")


@router.get(
    "/{device_id}/history",
    response_model=DeviceHistoryResponse,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.SYSADMIN))],
)
def get_device_history(device_id: UUID, db: Session = Depends(get_db)) -> DeviceHistoryResponse:
    exists = db.query(DeviceModel.id).filter(DeviceModel.id == device_id).first()
    if exists is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="device_not_found")

    rows = (
        db.query(RepairHistory)
        .options(joinedload(RepairHistory.repair_request))
        .filter(RepairHistory.device_id == device_id)
        .order_by(RepairHistory.created_at.desc())
        .all()
    )
    items = [
        RepairHistoryResponse(
            id=row.id,
            device_id=row.device_id,
            repair_request_id=row.repair_request_id,
            old_status=row.old_status,
            new_status=row.new_status,
            note=row.note,
            created_at=row.created_at,
            tracker_ticket_key=row.repair_request.tracker_ticket_key if row.repair_request else None,
            tracker_ticket_url=row.repair_request.tracker_ticket_url if row.repair_request else None,
        )
        for row in rows
    ]
    return DeviceHistoryResponse(items=items)
