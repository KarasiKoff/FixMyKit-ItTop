from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from backend.app.models.enums import AttachmentsSyncStatus, RequestStatus

RepairWorkflowKind = Literal["open", "in_progress", "needs_info", "closed"]
RepairCloseResolution = Literal["resolved", "wont_fix"]


class RepairRequestBase(BaseModel):
    device_id: UUID
    description: str
    applicant_name: str | None = None


class RepairRequestCreate(RepairRequestBase):
    author_user_id: UUID | None = None
    sync_to_tracker: bool = True


class PublicRepairRequestCreate(RepairRequestBase):
    applicant_name: str


class RepairRequestStatusUpdate(BaseModel):
    status: RequestStatus
    resolution_note: str | None = None
    resolution_desc: str | None = None


class RepairRequestTake(BaseModel):
    taken: bool


class RepairRequestClose(BaseModel):
    resolution_note: str | None = None
    resolution_desc: str | None = None


class RepairRequestUpdate(BaseModel):
    description: str | None = None
    status: RequestStatus | None = None
    resolution_note: str | None = None
    resolution_desc: str | None = None
    taken_by_sysadmin_by_user_id: UUID | None = None
    taken_by_sysadmin_at: datetime | None = None


class RepairRequestPublish(BaseModel):
    is_published: bool


class RepairRequestWorkflowUpdate(BaseModel):
    workflow: RepairWorkflowKind
    resolution: RepairCloseResolution | None = None
    comment: str | None = Field(default=None, max_length=10000)


class RepairRequestResponse(RepairRequestBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    author_user_id: UUID | None
    closed_by_user_id: UUID | None
    taken_by_sysadmin_by_user_id: UUID | None
    status: RequestStatus
    is_published: bool = False
    taken_by_sysadmin_at: datetime | None = None
    resolution_note: str | None = None
    resolution_desc: str | None = None
    closed_at: datetime | None = None
    tracker_ticket_id: str | None = None
    tracker_ticket_key: str | None = None
    tracker_ticket_url: str | None = None
    tracker_status_label: str | None = None
    tracker_status_sync_pending: bool = False
    last_sync_at: datetime | None = None
    has_attachments: bool = False
    attachments_sync_status: AttachmentsSyncStatus = AttachmentsSyncStatus.NONE
    attachments_count: int = 0
    attachments_synced_count: int = 0
    created_at: datetime
    updated_at: datetime
    device_inventory_number: str | None = None
    device_name: str | None = None


class RepairRequestList(BaseModel):
    items: list[RepairRequestResponse]
    total: int


class PublicRepairRequestResponse(BaseModel):
    id: UUID
    status: RequestStatus
    has_attachments: bool = False
    attachments_sync_status: AttachmentsSyncStatus = AttachmentsSyncStatus.NONE
    attachments_count: int = 0
    attachments_synced_count: int = 0


RepairRequestDetail = RepairRequestResponse
