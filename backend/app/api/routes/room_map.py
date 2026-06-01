from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, defer, joinedload, load_only

from backend.app.api.deps import get_db, require_admin_only, require_admin_or_sysadmin
from backend.app.models.audience import Audience
from backend.app.models.category import Category as CategoryModel
from backend.app.models.device import Device as DeviceModel
from backend.app.models.room_device_position import RoomDevicePosition
from backend.app.schemas.room_map import (
    DeviceOnMap,
    RoomDeviceListItem,
    RoomDeviceListResponse,
    RoomMapResponse,
    RoomMapSaveRequest,
)

router = APIRouter(prefix="/api/audiences", tags=["room-map"])


def _get_audience_or_404(db: Session, audience_id: int) -> Audience:
    obj = db.query(Audience).filter(Audience.id == audience_id).first()
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="audience_not_found")
    return obj


def _build_map_response(audience_id: int, db: Session) -> RoomMapResponse:
    audience = _get_audience_or_404(db, audience_id)
    rows = (
        db.query(RoomDevicePosition, DeviceModel, CategoryModel)
        .join(DeviceModel, RoomDevicePosition.device_id == DeviceModel.id)
        .outerjoin(CategoryModel, DeviceModel.category_id == CategoryModel.id)
        .options(defer(CategoryModel.icon_data))
        .filter(
            RoomDevicePosition.audience_id == audience_id,
            DeviceModel.audience_id == audience_id,
        )
        .all()
    )
    positions = [
        DeviceOnMap(
            device_id=pos.device_id,
            x_pct=pos.x_pct,
            y_pct=pos.y_pct,
            grid_col=pos.grid_col,
            grid_row=pos.grid_row,
            device_name=dev.name,
            inventory_number=dev.inventory_number,
            repair_status=dev.repair_status.value,
            category_id=dev.category_id,
            category_has_icon=bool(cat.icon_mime) if cat is not None else False,
        )
        for pos, dev, cat in rows
    ]
    door_edge = audience.map_door_edge if audience.map_door_edge in ("top", "bottom") else "bottom"
    return RoomMapResponse(
        audience_id=audience_id,
        grid_cols=audience.map_grid_cols,
        grid_rows=audience.map_grid_rows,
        door_edge=door_edge,
        positions=positions,
    )


@router.get("/{audience_id}/map", response_model=RoomMapResponse)
def get_room_map(
    audience_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin_or_sysadmin),
) -> RoomMapResponse:
    _get_audience_or_404(db, audience_id)
    return _build_map_response(audience_id, db)


@router.get("/{audience_id}/devices", response_model=RoomDeviceListResponse)
def get_audience_devices(
    audience_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin_or_sysadmin),
) -> RoomDeviceListResponse:
    _get_audience_or_404(db, audience_id)

    devices = (
        db.query(DeviceModel)
        .options(
            joinedload(DeviceModel.category).load_only(
                CategoryModel.id,
                CategoryModel.name,
                CategoryModel.icon_mime,
            ),
        )
        .filter(DeviceModel.audience_id == audience_id)
        .order_by(DeviceModel.name)
        .all()
    )
    placed_ids: set[UUID] = {
        row[0]
        for row in db.query(RoomDevicePosition.device_id)
        .filter(RoomDevicePosition.audience_id == audience_id)
        .all()
    }
    items = [
        RoomDeviceListItem(
            id=d.id,
            name=d.name,
            inventory_number=d.inventory_number,
            repair_status=d.repair_status.value,
            is_on_map=d.id in placed_ids,
            category_id=d.category_id,
            category_has_icon=bool(d.category.icon_mime) if d.category is not None else False,
        )
        for d in devices
    ]
    return RoomDeviceListResponse(items=items)


@router.put("/{audience_id}/map", response_model=RoomMapResponse)
def save_room_map(
    audience_id: int,
    payload: RoomMapSaveRequest,
    db: Session = Depends(get_db),
    _=Depends(require_admin_only),
) -> RoomMapResponse:
    audience = _get_audience_or_404(db, audience_id)
    audience.map_grid_cols = payload.grid_cols
    audience.map_grid_rows = payload.grid_rows
    audience.map_door_edge = payload.door_edge

    submitted_ids = {p.device_id for p in payload.positions}
    if submitted_ids:
        valid_count = (
            db.query(DeviceModel)
            .filter(
                DeviceModel.id.in_(submitted_ids),
                DeviceModel.audience_id == audience_id,
            )
            .count()
        )
        if valid_count != len(submitted_ids):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="device_not_in_room",
            )

    db.query(RoomDevicePosition).filter(
        RoomDevicePosition.audience_id == audience_id
    ).delete(synchronize_session=False)

    for p in payload.positions:
        db.add(
            RoomDevicePosition(
                audience_id=audience_id,
                device_id=p.device_id,
                x_pct=p.x_pct,
                y_pct=p.y_pct,
                grid_col=p.grid_col,
                grid_row=p.grid_row,
            )
        )
    db.commit()

    return _build_map_response(audience_id, db)
