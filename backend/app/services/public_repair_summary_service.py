"""Публичная сводка заявок для гостей (QR устройства / кабинета)."""

from __future__ import annotations

from backend.app.models.enums import RequestStatus
from backend.app.models.repair_request import RepairRequest
from backend.app.schemas.public_device import PublicRepairRequestItem


def summarize_public_repair_requests(
    requests: list[RepairRequest],
) -> tuple[PublicRepairRequestItem | None, bool, list[PublicRepairRequestItem]]:
    active_request: PublicRepairRequestItem | None = None
    has_unpublished_active = False
    history: list[PublicRepairRequestItem] = []

    for rr in requests:
        if rr.status in (
            RequestStatus.OPEN,
            RequestStatus.IN_PROGRESS,
            RequestStatus.NEEDS_INFO,
        ):
            if rr.is_published:
                active_request = PublicRepairRequestItem(
                    id=rr.id,
                    description=rr.description,
                    status=rr.status,
                    created_at=rr.created_at,
                    closed_at=rr.closed_at,
                    resolution_note=rr.resolution_note,
                    applicant_name=rr.applicant_name,
                )
            else:
                has_unpublished_active = True
        elif rr.status == RequestStatus.CLOSED and rr.is_published:
            history.append(
                PublicRepairRequestItem(
                    id=rr.id,
                    description=rr.description,
                    status=rr.status,
                    created_at=rr.created_at,
                    closed_at=rr.closed_at,
                    resolution_note=rr.resolution_note,
                    applicant_name=rr.applicant_name,
                )
            )

    return active_request, has_unpublished_active, history
