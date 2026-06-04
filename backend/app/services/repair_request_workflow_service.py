"""Смена статуса заявки с сайта (4 состояния как в Yandex Tracker)."""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.app.models.enums import RequestStatus
from backend.app.models.repair_request import RepairRequest
from backend.app.models.user import User
from backend.app.schemas.repair_request import RepairCloseResolution, RepairWorkflowKind
from backend.app.services.repair_history_service import add_repair_history
from backend.app.services.repair_request_closure_service import record_repair_request_closed
from backend.app.services.repair_request_comment_service import create_comment
from backend.app.services.repair_request_tracker_outbound import (
    sync_resolution_comment_to_tracker,
    sync_tracker_label_with_pending,
)

WORKFLOW_TRACKER_LABEL: dict[RepairWorkflowKind, str] = {
    "open": "Открыт",
    "in_progress": "В работе",
    "needs_info": "Требуется информация",
    "closed": "Закрыт",
}

WORKFLOW_REQUEST_STATUS: dict[RepairWorkflowKind, RequestStatus] = {
    "open": RequestStatus.OPEN,
    "in_progress": RequestStatus.IN_PROGRESS,
    "needs_info": RequestStatus.NEEDS_INFO,
    "closed": RequestStatus.CLOSED,
}

CLOSE_RESOLUTION_LABEL: dict[RepairCloseResolution, str] = {
    "resolved": "Решен",
    "wont_fix": "Не будет исправлено",
}

# Ключи резолюции в API Tracker
TRACKER_CLOSE_RESOLUTION_KEY: dict[RepairCloseResolution, str] = {
    "resolved": "fixed",
    "wont_fix": "wontFix",
}


def _reopen_from_closed(db: Session, repair_request: RepairRequest) -> None:
    from backend.app.models.enums import RepairStatus
    from backend.app.repositories.device_repository import DeviceRepository

    repair_request.closed_at = None
    repair_request.closed_by_user_id = None
    device = (
        DeviceRepository(db).get_by_id(repair_request.device_id)
        if repair_request.device_id is not None
        else None
    )
    if device is not None:
        device.repair_status = RepairStatus.IN_REPAIR


def apply_workflow_change(
    db: Session,
    repair_request: RepairRequest,
    actor: User,
    workflow: RepairWorkflowKind,
    *,
    resolution: RepairCloseResolution | None = None,
    comment: str | None = None,
) -> None:
    label = WORKFLOW_TRACKER_LABEL[workflow]
    target_status = WORKFLOW_REQUEST_STATUS[workflow]
    comment_text = (comment or "").strip()

    if workflow == "needs_info" and not comment_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="comment_required_for_needs_info",
        )

    if workflow == "closed" and resolution is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="resolution_required_for_close",
        )

    if repair_request.status == RequestStatus.CLOSED and workflow != "closed":
        _reopen_from_closed(db, repair_request)

    if workflow == "closed":
        resolution_label = CLOSE_RESOLUTION_LABEL[resolution]  # type: ignore[index]
        record_repair_request_closed(
            db,
            repair_request,
            actor,
            resolution_label,
            comment_text or None,
        )
        repair_request.tracker_status_label = label
        if repair_request.device_id is not None:
            add_repair_history(
                db,
                device_id=repair_request.device_id,
                repair_request_id=repair_request.id,
                old_status=None,
                new_status=None,
                note=f"Закрыто с сайта: {resolution_label}",
            )
        db.commit()
        db.refresh(repair_request)
        sync_tracker_label_with_pending(
            db,
            repair_request,
            label,
            resolution=TRACKER_CLOSE_RESOLUTION_KEY[resolution],  # type: ignore[index]
        )
        sync_resolution_comment_to_tracker(
            repair_request,
            resolution_label,
            comment_text or None,
        )
        return

    repair_request.status = target_status
    repair_request.tracker_status_label = label
    if repair_request.device_id is not None:
        add_repair_history(
            db,
            device_id=repair_request.device_id,
            repair_request_id=repair_request.id,
            old_status=None,
            new_status=None,
            note=f"Статус с сайта: {label}",
        )
    db.commit()
    db.refresh(repair_request)
    sync_tracker_label_with_pending(db, repair_request, label)

    if workflow == "needs_info" and comment_text:
        create_comment(db, repair_request, actor, comment_text)
