"""Смена статуса и закрытие заявки через API."""

from __future__ import annotations

from backend.app.models.enums import RequestStatus
from backend.app.models.repair_request import RepairRequest
from backend.app.models.user import User
from backend.app.schemas.repair_request import RepairRequestClose, RepairRequestStatusUpdate
from backend.app.services.repair_history_service import add_repair_history
from backend.app.services.repair_request_closure_service import record_repair_request_closed
from backend.app.services.repair_request_tracker_outbound import (
    REQUEST_STATUS_TRACKER_LABEL,
    RESOLUTION_NOTE_TO_TRACKER_KEY,
    sync_resolution_comment_to_tracker,
    sync_status_to_tracker,
)
from backend.app.services.repair_request_transitions import TransitionSource, assert_can_transition
from sqlalchemy.orm import Session


def update_repair_request_status(
    db: Session,
    repair_request: RepairRequest,
    actor: User,
    payload: RepairRequestStatusUpdate,
) -> RepairRequest:
    assert_can_transition(repair_request.status, payload.status, TransitionSource.API)

    if payload.status == RequestStatus.CLOSED:
        record_repair_request_closed(
            db,
            repair_request,
            actor,
            payload.resolution_note,
            payload.resolution_desc,
        )
    else:
        repair_request.status = payload.status
        repair_request.tracker_status_label = REQUEST_STATUS_TRACKER_LABEL[payload.status]
        if payload.resolution_note is not None:
            repair_request.resolution_note = payload.resolution_note
        if payload.resolution_desc is not None:
            repair_request.resolution_desc = payload.resolution_desc
        add_repair_history(
            db,
            device_id=repair_request.device_id,
            repair_request_id=repair_request.id,
            old_status=None,
            new_status=None,
            note=f"Статус заявки изменён: {payload.status.value}",
        )

    db.commit()
    db.refresh(repair_request)
    tracker_resolution = None
    if payload.status == RequestStatus.CLOSED and payload.resolution_note:
        tracker_resolution = RESOLUTION_NOTE_TO_TRACKER_KEY.get(payload.resolution_note.strip())
    sync_status_to_tracker(
        db,
        repair_request,
        payload.status,
        resolution=tracker_resolution,
    )
    if payload.status == RequestStatus.CLOSED:
        sync_resolution_comment_to_tracker(
            repair_request,
            payload.resolution_note,
            payload.resolution_desc,
        )
    return repair_request


def close_repair_request(
    db: Session,
    repair_request: RepairRequest,
    actor: User,
    payload: RepairRequestClose,
) -> RepairRequest:
    assert_can_transition(repair_request.status, RequestStatus.CLOSED, TransitionSource.API)

    record_repair_request_closed(
        db,
        repair_request,
        actor,
        payload.resolution_note,
        payload.resolution_desc,
    )
    repair_request.tracker_status_label = REQUEST_STATUS_TRACKER_LABEL[RequestStatus.CLOSED]
    db.commit()
    db.refresh(repair_request)
    tracker_resolution = None
    if payload.resolution_note:
        tracker_resolution = RESOLUTION_NOTE_TO_TRACKER_KEY.get(payload.resolution_note.strip())
    sync_status_to_tracker(
        db,
        repair_request,
        RequestStatus.CLOSED,
        resolution=tracker_resolution,
    )
    sync_resolution_comment_to_tracker(
        repair_request,
        payload.resolution_note,
        payload.resolution_desc,
    )
    return repair_request
