"""Сборка и сохранение карты кабинета."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.app.models.room_device_position import RoomDevicePosition
from backend.app.repositories.audience_repository import AudienceRepository
from backend.app.repositories.room_map_repository import RoomMapRepository
from backend.app.schemas.room_map import DeviceOnMap, RoomMapResponse, RoomMapSaveRequest


def build_room_map_response(db: Session, audience_id: UUID) -> RoomMapResponse:
    audience = AudienceRepository(db).get_or_404(audience_id)
    rows = RoomMapRepository(db).fetch_map_rows(audience_id)
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


def save_room_map(db: Session, audience_id: UUID, payload: RoomMapSaveRequest) -> RoomMapResponse:
    audience_repo = AudienceRepository(db)
    map_repo = RoomMapRepository(db)
    audience = audience_repo.get_or_404(audience_id)
    audience.map_grid_cols = payload.grid_cols
    audience.map_grid_rows = payload.grid_rows
    audience.map_door_edge = payload.door_edge

    submitted_ids = {p.device_id for p in payload.positions}
    if submitted_ids:
        valid_count = map_repo.count_devices_in_audience(submitted_ids, audience_id)
        if valid_count != len(submitted_ids):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="device_not_in_room",
            )

    map_repo.replace_positions(
        audience_id,
        [
            RoomDevicePosition(
                audience_id=audience_id,
                device_id=p.device_id,
                x_pct=p.x_pct,
                y_pct=p.y_pct,
                grid_col=p.grid_col,
                grid_row=p.grid_row,
            )
            for p in payload.positions
        ],
    )
    db.commit()
    return build_room_map_response(db, audience_id)
