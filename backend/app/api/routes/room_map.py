from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.api.deps import get_db, require_admin_only, require_admin_or_sysadmin
from backend.app.repositories.audience_repository import AudienceRepository
from backend.app.repositories.room_map_repository import RoomMapRepository
from backend.app.schemas.room_map import (
    RoomDeviceListItem,
    RoomDeviceListResponse,
    RoomMapResponse,
    RoomMapSaveRequest,
)
from backend.app.services.room_map_service import build_room_map_response, save_room_map

router = APIRouter(prefix="/api/audiences", tags=["room-map"])


@router.get("/{audience_id}/map", response_model=RoomMapResponse)
def get_room_map(
    audience_id: UUID,
    db: Session = Depends(get_db),
    _=Depends(require_admin_or_sysadmin),
) -> RoomMapResponse:
    AudienceRepository(db).get_or_404(audience_id)
    return build_room_map_response(db, audience_id)


@router.get("/{audience_id}/devices", response_model=RoomDeviceListResponse)
def get_audience_devices(
    audience_id: UUID,
    db: Session = Depends(get_db),
    _=Depends(require_admin_or_sysadmin),
) -> RoomDeviceListResponse:
    AudienceRepository(db).get_or_404(audience_id)
    map_repo = RoomMapRepository(db)
    devices = map_repo.list_devices_in_audience(audience_id)
    placed_ids = map_repo.placed_device_ids(audience_id)
    items = [
        RoomDeviceListItem(
            id=d.id,
            name=d.name,
            inventory_number=d.inventory_number,
            repair_status=d.repair_status.value,
            is_on_map=d.id in placed_ids,
            category_id=d.category_id,
            category_has_icon=bool(d.category.icon_mime)
            if d.category is not None
            else False,
        )
        for d in devices
    ]
    return RoomDeviceListResponse(items=items)


@router.put("/{audience_id}/map", response_model=RoomMapResponse)
def put_room_map(
    audience_id: UUID,
    payload: RoomMapSaveRequest,
    db: Session = Depends(get_db),
    _=Depends(require_admin_only),
) -> RoomMapResponse:
    return save_room_map(db, audience_id, payload)
