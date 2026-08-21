from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.api.deps import get_db
from backend.app.core.config import settings
from backend.app.integrations.registry import (
    external_tracker_enabled,
    external_tracker_label,
)
from backend.app.repositories.audience_repository import AudienceRepository
from backend.app.repositories.device_repository import DeviceRepository
from backend.app.repositories.repair_request_repository import RepairRequestRepository
from backend.app.schemas.attachments import AttachmentLimitsResponse
from backend.app.schemas.integration import IntegrationPublicResponse
from backend.app.services.attachment_validation import effective_max_attachment_bytes
from backend.app.schemas.public_audience import (
    PublicAudienceRepairSummaryResponse,
    PublicAudienceResponse,
)
from backend.app.schemas.public_device import (
    PublicDeviceResponse,
    PublicRepairSummaryResponse,
)
from backend.app.schemas.public_shorten import ShortenUrlRequest, ShortenUrlResponse
from backend.app.services.public_repair_summary_service import (
    summarize_public_repair_requests,
)
from backend.app.services.url_shortener import (
    assert_allowed_shorten_url,
    shorten_via_clck,
)

router = APIRouter(prefix="/api/public", tags=["public"])


@router.get("/integration", response_model=IntegrationPublicResponse)
def get_public_integration() -> IntegrationPublicResponse:
    provider = settings.server.resolved_issue_tracker()
    return IntegrationPublicResponse(
        provider=provider,  # type: ignore[arg-type]
        enabled=external_tracker_enabled(),
        label=external_tracker_label(),
    )


@router.get("/attachment-limits", response_model=AttachmentLimitsResponse)
def get_attachment_limits() -> AttachmentLimitsResponse:
    return AttachmentLimitsResponse(
        max_per_request=settings.server.attachment_max_per_request,
        max_bytes=effective_max_attachment_bytes(),
    )


@router.get("/devices/by-inventory", response_model=PublicDeviceResponse)
def get_public_device_by_inventory(
    number: str = Query(
        ..., min_length=1, description="Инвентарный номер (без учёта регистра)"
    ),
    db: Session = Depends(get_db),
) -> PublicDeviceResponse:
    device = DeviceRepository(db).get_by_inventory_casefold(number)
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="device_not_found"
        )
    return PublicDeviceResponse.model_validate(device)


@router.get("/devices/{device_id}", response_model=PublicDeviceResponse)
def get_public_device(
    device_id: UUID, db: Session = Depends(get_db)
) -> PublicDeviceResponse:
    device = DeviceRepository(db).get_public_or_404(device_id)
    return PublicDeviceResponse.model_validate(device)


@router.get("/audiences/by-name", response_model=PublicAudienceResponse)
def get_public_audience_by_name(
    name: str = Query(
        ..., min_length=1, description="Название кабинета (без учёта регистра)"
    ),
    db: Session = Depends(get_db),
) -> PublicAudienceResponse:
    audience = AudienceRepository(db).get_by_name_casefold(name)
    if audience is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="audience_not_found"
        )
    return PublicAudienceResponse.model_validate(audience)


@router.get("/audiences/{audience_id}", response_model=PublicAudienceResponse)
def get_public_audience(
    audience_id: UUID, db: Session = Depends(get_db)
) -> PublicAudienceResponse:
    audience = AudienceRepository(db).get_or_404(audience_id)
    return PublicAudienceResponse.model_validate(audience)


@router.post("/shorten-url", response_model=ShortenUrlResponse)
def shorten_public_url(payload: ShortenUrlRequest) -> ShortenUrlResponse:
    absolute = assert_allowed_shorten_url(payload.url)
    short = shorten_via_clck(absolute)
    return ShortenUrlResponse(url=absolute, short_url=short)


@router.get(
    "/devices/{device_id}/repair-summary", response_model=PublicRepairSummaryResponse
)
def get_public_repair_summary(
    device_id: UUID, db: Session = Depends(get_db)
) -> PublicRepairSummaryResponse:
    device = DeviceRepository(db).get_public_or_404(device_id)
    requests = RepairRequestRepository(db).list_for_device(device_id)
    active_request, has_unpublished_active, history = summarize_public_repair_requests(
        requests
    )
    return PublicRepairSummaryResponse(
        device=PublicDeviceResponse.model_validate(device),
        active_request=active_request,
        has_unpublished_active=has_unpublished_active,
        history=history,
    )


@router.get(
    "/audiences/{audience_id}/repair-summary",
    response_model=PublicAudienceRepairSummaryResponse,
)
def get_public_audience_repair_summary(
    audience_id: UUID,
    db: Session = Depends(get_db),
) -> PublicAudienceRepairSummaryResponse:
    audience = AudienceRepository(db).get_or_404(audience_id)
    requests = RepairRequestRepository(db).list_for_audience(audience_id)
    active_request, has_unpublished_active, history = summarize_public_repair_requests(
        requests
    )
    return PublicAudienceRepairSummaryResponse(
        audience=PublicAudienceResponse.model_validate(audience),
        active_request=active_request,
        has_unpublished_active=has_unpublished_active,
        history=history,
    )
