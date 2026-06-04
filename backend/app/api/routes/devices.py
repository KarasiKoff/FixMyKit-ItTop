from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.api.deps import get_db, require_roles
from backend.app.models.enums import RepairStatus, UserRole
from backend.app.queries.device_list_query import DeviceSortBy, suggest_devices
from backend.app.schemas.device import Device, DeviceCreate, DeviceHistoryResponse, DeviceListResponse, DeviceQrResponse, DeviceUpdate
from backend.app.schemas.suggest import SuggestResponse
from backend.app.services import device_route_service as device_svc

router = APIRouter(prefix="/api/devices", tags=["devices"])


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
    if field not in device_svc.DEVICE_SUGGEST_FIELDS:
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
    sort_by: DeviceSortBy = Query(default="inventory_number"),
    sort_dir: Literal["asc", "desc"] = Query(default="asc"),
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> DeviceListResponse:
    return device_svc.list_devices(
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


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=Device,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.SYSADMIN))],
)
def create_device(payload: DeviceCreate, db: Session = Depends(get_db)) -> Device:
    return device_svc.create_device(db, payload)


@router.get(
    "/{device_id}",
    response_model=Device,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.SYSADMIN))],
)
def get_device(device_id: UUID, db: Session = Depends(get_db)) -> Device:
    return device_svc.get_device(db, device_id)


@router.patch(
    "/{device_id}",
    response_model=Device,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.SYSADMIN))],
)
def patch_device(device_id: UUID, payload: DeviceUpdate, db: Session = Depends(get_db)) -> Device:
    return device_svc.patch_device(db, device_id, payload)


@router.delete(
    "/{device_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.SYSADMIN))],
)
def delete_device(device_id: UUID, db: Session = Depends(get_db)) -> None:
    device_svc.delete_device(db, device_id)


@router.get(
    "/{device_id}/qr",
    response_model=DeviceQrResponse,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.SYSADMIN))],
)
def get_device_qr(device_id: UUID, db: Session = Depends(get_db)) -> DeviceQrResponse:
    return device_svc.device_qr(db, device_id)


@router.get(
    "/{device_id}/history",
    response_model=DeviceHistoryResponse,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.SYSADMIN))],
)
def get_device_history(device_id: UUID, db: Session = Depends(get_db)) -> DeviceHistoryResponse:
    return device_svc.device_history(db, device_id)
