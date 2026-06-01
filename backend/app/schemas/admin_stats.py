from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel


class RepairRequestStats(BaseModel):
    total: int
    open: int
    in_progress: int
    resolved: int
    wont_fix: int
    tracker_synced: int


class CatalogStats(BaseModel):
    devices_total: int
    categories_total: int
    audiences_total: int


class CategoryDeviceCount(BaseModel):
    category_id: UUID | None
    category_name: str
    device_count: int
    share_percent: float


class AdminStatsResponse(BaseModel):
    date_from: date | None
    date_to: date | None
    repair_requests: RepairRequestStats
    catalog: CatalogStats
    devices_by_category: list[CategoryDeviceCount]
    last_tracker_sync_at: datetime | None
