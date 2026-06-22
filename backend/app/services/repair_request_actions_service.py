"""Действия над заявкой из UI: workflow, take, publish, push статуса во внешний трекер."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.app.integrations.registry import external_tracker_enabled
from backend.app.models.user import User
from backend.app.schemas.repair_request import (
    RepairRequestClose,
    RepairRequestDetail,
    RepairRequestPublish,
    RepairRequestStatusUpdate,
    RepairRequestTake,
    RepairRequestWorkflowUpdate,
)
from backend.app.services.repair_history_service import add_repair_history
from backend.app.repositories.repair_request_repository import (
    RepairRequestRepository,
    get_repair_request_or_404,
)
from backend.app.services.repair_request_status_service import (
    close_repair_request as close_repair_request_impl,
    update_repair_request_status as update_repair_request_status_impl,
)
from backend.app.services.repair_request_sysadmin_taken_service import (
    clear_sysadmin_taken_fields,
)
from backend.app.services.repair_request_tracker_outbound import (
    require_external_ticket,
    retry_pending_status_sync,
    sync_publish_to_tracker,
    sync_sysadmin_taken_to_tracker,
)
from backend.app.services.repair_request_workflow_service import apply_workflow_change
from backend.app.services.realtime_notify import notify_repair_request_updated


def _to_detail(db: Session, request_id: UUID) -> RepairRequestDetail:
    return RepairRequestRepository(db).load_detail(request_id)


def _require_ticket_if_tracker_enabled(repair_request) -> None:
    if external_tracker_enabled():
        require_external_ticket(repair_request)


def update_workflow(
    db: Session,
    request_id: UUID,
    actor: User,
    payload: RepairRequestWorkflowUpdate,
) -> RepairRequestDetail:
    repair_request = get_repair_request_or_404(db, request_id)
    _require_ticket_if_tracker_enabled(repair_request)
    apply_workflow_change(
        db,
        repair_request,
        actor,
        payload.workflow,
        resolution=payload.resolution,
        comment=payload.comment,
    )
    db.refresh(repair_request)
    notify_repair_request_updated(repair_request, source="api")
    return _to_detail(db, request_id)


def update_status(
    db: Session,
    request_id: UUID,
    actor: User,
    payload: RepairRequestStatusUpdate,
) -> RepairRequestDetail:
    repair_request = get_repair_request_or_404(db, request_id)
    _require_ticket_if_tracker_enabled(repair_request)
    update_repair_request_status_impl(db, repair_request, actor, payload)
    notify_repair_request_updated(repair_request, source="api")
    return _to_detail(db, request_id)


def close_request(
    db: Session,
    request_id: UUID,
    actor: User,
    payload: RepairRequestClose,
) -> RepairRequestDetail:
    repair_request = get_repair_request_or_404(db, request_id)
    _require_ticket_if_tracker_enabled(repair_request)
    close_repair_request_impl(db, repair_request, actor, payload)
    notify_repair_request_updated(repair_request, source="api")
    return _to_detail(db, request_id)


def update_take(
    db: Session,
    request_id: UUID,
    actor: User,
    payload: RepairRequestTake,
) -> RepairRequestDetail:
    repair_request = get_repair_request_or_404(db, request_id)
    _require_ticket_if_tracker_enabled(repair_request)
    if payload.taken:
        repair_request.taken_by_sysadmin_at = datetime.now(timezone.utc)
        repair_request.taken_by_sysadmin_by_user_id = actor.id
        add_repair_history(
            db,
            device_id=repair_request.device_id,
            repair_request_id=repair_request.id,
            old_status=None,
            new_status=None,
            note="Отмечено: забрал системный администратор",
        )
    else:
        clear_sysadmin_taken_fields(repair_request)
        add_repair_history(
            db,
            device_id=repair_request.device_id,
            repair_request_id=repair_request.id,
            old_status=None,
            new_status=None,
            note="Устройство возвращено на место",
        )
    db.commit()
    db.refresh(repair_request)
    sync_sysadmin_taken_to_tracker(repair_request, taken=payload.taken)
    notify_repair_request_updated(repair_request, source="api")
    return _to_detail(db, request_id)


def update_publish(
    db: Session,
    request_id: UUID,
    payload: RepairRequestPublish,
) -> RepairRequestDetail:
    repair_request = get_repair_request_or_404(db, request_id)
    _require_ticket_if_tracker_enabled(repair_request)
    repair_request.is_published = payload.is_published
    db.commit()
    db.refresh(repair_request)
    sync_publish_to_tracker(repair_request, payload.is_published)
    notify_repair_request_updated(repair_request, source="api")
    return _to_detail(db, request_id)


def push_status_to_tracker(db: Session, request_id: UUID) -> RepairRequestDetail:
    if not external_tracker_enabled():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="external_tracker_disabled",
        )
    repair_request = get_repair_request_or_404(db, request_id)
    require_external_ticket(repair_request)
    if not repair_request.tracker_status_sync_pending:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="tracker_status_sync_not_pending",
        )
    retry_pending_status_sync(db, repair_request)
    db.refresh(repair_request)
    notify_repair_request_updated(repair_request, source="api")
    return _to_detail(db, request_id)
