from uuid import UUID

from pydantic import BaseModel, ConfigDict

from backend.app.schemas.public_device import PublicRepairRequestItem


class PublicAudienceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str


class PublicAudienceRepairSummaryResponse(BaseModel):
    audience: PublicAudienceResponse
    active_request: PublicRepairRequestItem | None = None
    has_unpublished_active: bool
    history: list[PublicRepairRequestItem]
