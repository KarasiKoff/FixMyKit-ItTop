from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

MapDoorEdge = Literal["top", "bottom"]


class DevicePositionItem(BaseModel):
    device_id: UUID
    x_pct: float = Field(ge=0.0, le=100.0)
    y_pct: float = Field(ge=0.0, le=100.0)
    grid_col: int | None = Field(default=None, ge=0, le=9)
    grid_row: int | None = Field(default=None, ge=0, le=9)


class DeviceOnMap(DevicePositionItem):
    model_config = ConfigDict(from_attributes=True)

    device_name: str
    inventory_number: str
    repair_status: str
    category_id: UUID | None = None
    category_has_icon: bool = False


class RoomMapResponse(BaseModel):
    audience_id: int
    grid_cols: int = 4
    grid_rows: int = 4
    door_edge: MapDoorEdge = "bottom"
    positions: list[DeviceOnMap]


class RoomMapSaveRequest(BaseModel):
    positions: list[DevicePositionItem]
    grid_cols: int = Field(default=4, ge=1, le=10)
    grid_rows: int = Field(default=4, ge=1, le=10)
    door_edge: MapDoorEdge = "bottom"


class RoomDeviceListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    inventory_number: str
    repair_status: str
    is_on_map: bool = False
    category_id: UUID | None = None
    category_has_icon: bool = False


class RoomDeviceListResponse(BaseModel):
    items: list[RoomDeviceListItem]
