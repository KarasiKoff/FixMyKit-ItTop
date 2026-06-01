"""Уведомления подписчиков SSE об изменениях заявок."""

from uuid import UUID

from backend.app.models.enums import RequestStatus
from backend.app.models.repair_request import RepairRequest
from backend.app.services.realtime_hub import publish_event

REPAIR_REQUEST_EVENT = "repair_request"


def notify_repair_request_updated(
    repair_request: RepairRequest,
    *,
    source: str,
) -> None:
    publish_event(
        REPAIR_REQUEST_EVENT,
        {
            "type": "updated",
            "repair_request_id": str(repair_request.id),
            "device_id": str(repair_request.device_id),
            "status": repair_request.status.value
            if isinstance(repair_request.status, RequestStatus)
            else str(repair_request.status),
            "source": source,
        },
    )


def notify_repair_request_updated_ids(
    repair_request_id: UUID,
    device_id: UUID,
    status: RequestStatus | str,
    *,
    source: str,
) -> None:
    st = status.value if isinstance(status, RequestStatus) else str(status)
    publish_event(
        REPAIR_REQUEST_EVENT,
        {
            "type": "updated",
            "repair_request_id": str(repair_request_id),
            "device_id": str(device_id),
            "status": st,
            "source": source,
        },
    )
