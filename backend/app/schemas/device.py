from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from backend.app.models.enums import RepairStatus
from backend.app.schemas.audience import Audience
from backend.app.schemas.category import Category
from backend.app.schemas.repair_history import RepairHistoryResponse
from backend.app.schemas.user import UserResponse


class DeviceBase(BaseModel):
    inventory_number: str
    name: str
    serial_number: str | None = None
    audience_id: int | None = None
    category_id: UUID | None = None
    responsible_id: UUID | None = None
    repair_status: RepairStatus = RepairStatus.NOT_IN_REPAIR


class DeviceCreate(DeviceBase):
    pass


class DeviceUpdate(BaseModel):
    inventory_number: str | None = None
    name: str | None = None
    serial_number: str | None = None
    audience_id: int | None = None
    category_id: UUID | None = None
    responsible_id: UUID | None = None
    repair_status: RepairStatus | None = None


class Device(DeviceBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime
    category: Category | None = None
    audience: Audience | None = None
    responsible: UserResponse | None = None


class DeviceDetail(Device):
    taken_by_sysadmin: bool = False


class DeviceListResponse(BaseModel):
    items: list[Device]
    total: int


class DeviceQrResponse(BaseModel):
    device_id: UUID
    url: str


class DeviceHistoryResponse(BaseModel):
    items: list[RepairHistoryResponse]
