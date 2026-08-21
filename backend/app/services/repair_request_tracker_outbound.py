"""Исходящая синхронизация заявки с внешним трекером (Jira / Yandex Tracker)."""

from __future__ import annotations

import logging

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.app.integrations.registry import external_tracker_enabled, get_issue_tracker
from backend.app.integrations.types import IssueTrackerUnavailableError
from backend.app.models.enums import RequestStatus
from backend.app.models.repair_request import RepairRequest
from backend.app.models.user import User
from backend.app.services.tracker_types import issue_ref_for

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


def require_external_ticket(repair_request: RepairRequest) -> str:
    ref = issue_ref_for(repair_request)
    if not ref:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="tracker_ticket_required",
        )
    return ref


def require_tracker_ticket(repair_request: RepairRequest) -> str:
    """Обратная совместимость."""
    return require_external_ticket(repair_request)


def _tracker_http_error(exc: IssueTrackerUnavailableError) -> HTTPException:
    logger.warning("external_tracker_outbound_failed: %s", exc.message)
    detail = "tracker_unavailable"
    msg = (exc.message or "").strip()
    if msg.startswith("jira_http_") or msg.startswith("jira_transition"):
        detail = msg[:200]
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=detail,
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
    require_external_ticket(repair_request)
    tracker = get_issue_tracker()
    tracker.push_status(repair_request, label, resolution=resolution)
    try:
        tracker.add_comment(
            repair_request,
            tracker.status_comment_from_site(label),
        )
    except IssueTrackerUnavailableError as exc:
        logger.warning(
            "external_tracker_status_comment_failed request=%s label=%r: %s",
            repair_request.id,
            label,
            exc.message,
        )


def sync_tracker_label_with_pending(
    db: Session,
    repair_request: RepairRequest,
    label: str,
    *,
    resolution: str | None = None,
) -> None:
    """Синхронизирует статус; при ошибке трекера помечает заявку для повторной отправки."""
    if not external_tracker_enabled():
        return
    try:
        _push_status_label_to_tracker(repair_request, label, resolution=resolution)
        repair_request.tracker_status_sync_pending = False
        db.commit()
    except IssueTrackerUnavailableError as exc:
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
    if not external_tracker_enabled():
        return
    try:
        _push_status_label_to_tracker(repair_request, label, resolution=resolution)
    except IssueTrackerUnavailableError as exc:
        raise _tracker_http_error(exc) from exc


def sync_resolution_comment_to_tracker(
    repair_request: RepairRequest,
    resolution_note: str | None,
    resolution_desc: str | None,
) -> None:
    if not external_tracker_enabled():
        return
    parts: list[str] = []
    if resolution_note and resolution_note.strip():
        parts.append(f"**Резолюция:** {resolution_note.strip()}")
    if resolution_desc and resolution_desc.strip():
        parts.append(resolution_desc.strip())
    if not parts:
        return
    text = "\n\n".join(parts)
    try:
        get_issue_tracker().add_comment(repair_request, text)
    except IssueTrackerUnavailableError as exc:
        raise _tracker_http_error(exc) from exc


def sync_user_comment_to_tracker(
    repair_request: RepairRequest, user: User, body: str
) -> None:
    if not external_tracker_enabled():
        return
    try:
        get_issue_tracker().add_site_user_comment(repair_request, user, body)
    except IssueTrackerUnavailableError as exc:
        raise _tracker_http_error(exc) from exc


def sync_publish_to_tracker(repair_request: RepairRequest, is_published: bool) -> None:
    if not external_tracker_enabled():
        return
    try:
        get_issue_tracker().push_publish_comment(
            repair_request, is_published=is_published
        )
    except IssueTrackerUnavailableError as exc:
        raise _tracker_http_error(exc) from exc


def sync_sysadmin_taken_to_tracker(
    repair_request: RepairRequest, *, taken: bool
) -> None:
    if not external_tracker_enabled():
        return
    try:
        get_issue_tracker().push_sysadmin_taken_comment(
            repair_request, taken=taken
        )
    except IssueTrackerUnavailableError as exc:
        raise _tracker_http_error(exc) from exc
