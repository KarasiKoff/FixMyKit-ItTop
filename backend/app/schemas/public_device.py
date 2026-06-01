from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from backend.app.schemas.audience import Audience
from backend.app.schemas.category import Category
from backend.app.models.enums import RequestStatus


class PublicDeviceResponse(BaseModel):
    """Минимальные данные устройства для публичной формы заявки (без авторизации)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    inventory_number: str
    name: str
    category: Category | None = None
    audience: Audience | None = None


class PublicRepairRequestItem(BaseModel):
    """Одна заявка на ремонт для публичного просмотра."""

    id: UUID
    description: str
    status: RequestStatus
    created_at: datetime
    closed_at: datetime | None = None
    resolution_note: str | None = None
    applicant_name: str | None = None


class PublicRepairSummaryResponse(BaseModel):
    """Публичная история ремонтов устройства."""

    device: PublicDeviceResponse
    active_request: PublicRepairRequestItem | None = None
    has_unpublished_active: bool
    history: list[PublicRepairRequestItem]
