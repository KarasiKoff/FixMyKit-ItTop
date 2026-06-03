"""Исходящая синхронизация заявки с Yandex Tracker (действия с сайта)."""

from __future__ import annotations

import logging

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.app.models.enums import RequestStatus
from backend.app.models.repair_request import RepairRequest
from backend.app.models.user import User
from backend.app.services.tracker_service import (
    TrackerUnavailableError,
    issue_ref_for,
    post_issue_comment,
    post_site_user_comment,
    push_issue_status_from_site,
    push_publish_state_comment,
    push_sysadmin_taken_comment,
    tracker_comment_status_from_site,
)

logger = logging.getLogger(__name__)

REQUEST_STATUS_TRACKER_LABEL: dict[RequestStatus, str] = {
    RequestStatus.OPEN: "Открыт",
    RequestStatus.IN_PROGRESS: "В работе",
    RequestStatus.NEEDS_INFO: "Требуется информация",
    RequestStatus.CLOSED: "Закрыт",
}

RESOLUTION_NOTE_TO_TRACKER_KEY: dict[str, str] = {
    "Решен": "fixed",
    "Не будет исправлено": "wontFix",
}


def require_tracker_ticket(repair_request: RepairRequest) -> str:
    ref = issue_ref_for(repair_request)
    if not ref:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="tracker_ticket_required",
        )
    return ref


def _tracker_http_error(exc: TrackerUnavailableError) -> HTTPException:
    logger.warning("tracker_outbound_failed: %s", exc.message)
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="tracker_unavailable",
    )


def tracker_resolution_key_for_request(repair_request: RepairRequest) -> str | None:
    if repair_request.status != RequestStatus.CLOSED:
        return None
    note = (repair_request.resolution_note or "").strip()
    if not note:
        return None
    return RESOLUTION_NOTE_TO_TRACKER_KEY.get(note)


def _push_status_label_to_tracker(
    repair_request: RepairRequest,
    label: str,
    *,
    resolution: str | None = None,
) -> None:
    ref = require_tracker_ticket(repair_request)
    push_issue_status_from_site(ref, label, resolution=resolution)
    post_issue_comment(ref, tracker_comment_status_from_site(label))


def sync_tracker_label_with_pending(
    db: Session,
    repair_request: RepairRequest,
    label: str,
    *,
    resolution: str | None = None,
) -> None:
    """Синхронизирует статус; при ошибке Трекера помечает заявку для повторной отправки."""
    try:
        _push_status_label_to_tracker(repair_request, label, resolution=resolution)
        repair_request.tracker_status_sync_pending = False
        db.commit()
    except TrackerUnavailableError as exc:
        repair_request.tracker_status_sync_pending = True
        db.commit()
        raise _tracker_http_error(exc) from exc


def retry_pending_status_sync(db: Session, repair_request: RepairRequest) -> None:
    label = (repair_request.tracker_status_label or "").strip()
    if not label:
        label = REQUEST_STATUS_TRACKER_LABEL[repair_request.status]
    resolution = tracker_resolution_key_for_request(repair_request)
    sync_tracker_label_with_pending(db, repair_request, label, resolution=resolution)


def sync_status_to_tracker(
    db: Session,
    repair_request: RepairRequest,
    target: RequestStatus,
    *,
    resolution: str | None = None,
) -> None:
    label = repair_request.tracker_status_label
    if not label:
        label = REQUEST_STATUS_TRACKER_LABEL[target]
    sync_tracker_label_with_pending(db, repair_request, label, resolution=resolution)


def sync_tracker_label_to_tracker(
    repair_request: RepairRequest,
    label: str,
    *,
    resolution: str | None = None,
) -> None:
    """Без записи pending в БД — только для вызовов без сессии (не использовать после workflow)."""
    try:
        _push_status_label_to_tracker(repair_request, label, resolution=resolution)
    except TrackerUnavailableError as exc:
        raise _tracker_http_error(exc) from exc


def sync_resolution_comment_to_tracker(
    repair_request: RepairRequest,
    resolution_note: str | None,
    resolution_desc: str | None,
) -> None:
    parts: list[str] = []
    if resolution_note and resolution_note.strip():
        parts.append(f"**Резолюция:** {resolution_note.strip()}")
    if resolution_desc and resolution_desc.strip():
        parts.append(resolution_desc.strip())
    if not parts:
        return
    ref = require_tracker_ticket(repair_request)
    text = "\n\n".join(parts)
    try:
        post_issue_comment(ref, text)
    except TrackerUnavailableError as exc:
        raise _tracker_http_error(exc) from exc


def sync_user_comment_to_tracker(repair_request: RepairRequest, user: User, body: str) -> None:
    ref = require_tracker_ticket(repair_request)
    try:
        post_site_user_comment(ref, user, body)
    except TrackerUnavailableError as exc:
        raise _tracker_http_error(exc) from exc


def sync_publish_to_tracker(repair_request: RepairRequest, is_published: bool) -> None:
    ref = require_tracker_ticket(repair_request)
    try:
        push_publish_state_comment(ref, is_published)
    except TrackerUnavailableError as exc:
        raise _tracker_http_error(exc) from exc


def sync_sysadmin_taken_to_tracker(repair_request: RepairRequest, *, taken: bool) -> None:
    ref = require_tracker_ticket(repair_request)
    try:
        push_sysadmin_taken_comment(ref, taken=taken)
    except TrackerUnavailableError as exc:
        raise _tracker_http_error(exc) from exc
