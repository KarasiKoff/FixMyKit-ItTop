from datetime import datetime

from pydantic import BaseModel


class TrackerSyncResponse(BaseModel):
    tracker_ticket_id: str
    tracker_ticket_key: str
    tracker_ticket_url: str
    last_sync_at: datetime


class TrackerBulkSyncResponse(BaseModel):
    attempted: int
    synced: int
    failed: int
