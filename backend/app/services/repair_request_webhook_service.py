"""Обработка входящих вебхуков Yandex Tracker."""

from __future__ import annotations

import hmac
import logging
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.repositories.device_repository import DeviceRepository
from backend.app.repositories.repair_request_repository import find_repair_request_for_tracker
from backend.app.repositories.user_repository import UserRepository
from backend.app.models.enums import RepairStatus, RequestStatus
from backend.app.models.repair_request import RepairRequest
from backend.app.models.user import User
from backend.app.schemas.tracker_webhook import (
    YandexTrackerCommentPayload,
    YandexTrackerPublishPayload,
    YandexTrackerSysadminTakenPayload,
    YandexTrackerWebhookPayload,
    YandexTrackerWebhookResponse,
)
from backend.app.services.repair_history_service import add_repair_history
from backend.app.services.repair_request_closure_service import record_repair_request_closed
from backend.app.services.repair_request_sysadmin_taken_service import (
    record_sysadmin_returned,
    record_sysadmin_taken,
)
from backend.app.services.repair_request_tracker_comment_inbound import create_comment_from_tracker
from backend.app.services.repair_request_transitions import TransitionSource, assert_can_transition
from backend.app.services.realtime_notify import notify_repair_request_updated
from backend.app.services.tracker_service import (
    TrackerUnavailableError,
    PUBLISH_TRACKER_COMMENT,
    SYSADMIN_RETURNED_TRACKER_COMMENT,
    SYSADMIN_TAKEN_TRACKER_COMMENT,
    UNPUBLISH_TRACKER_COMMENT,
    post_issue_comment,
    tracker_comment_status_sync,
)

logger = logging.getLogger(__name__)

TRACKER_WEBHOOK_SECRET_HEADER = "X-Tracker-Webhook-Secret"

TRACKER_STATUS_ALIASES: dict[str, RequestStatus] = {
    "Открыт": RequestStatus.OPEN,
    "В работе": RequestStatus.IN_PROGRESS,
    "Требуется информация": RequestStatus.NEEDS_INFO,
    "Закрыт": RequestStatus.CLOSED,
}


def verify_webhook_secret(header_value: str | None) -> None:
    expected = (settings.server.tracker_webhook_secret or "").strip()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="webhook_not_configured",
        )
    if not header_value:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="missing_webhook_secret",
        )
    a = header_value.encode("utf-8")
    b = expected.encode("utf-8")
    if len(a) != len(b) or not hmac.compare_digest(a, b):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_webhook_secret",
        )


def _map_tracker_status_to_request(raw: str) -> RequestStatus | None:
    if not raw or not raw.strip():
        return None
    return TRACKER_STATUS_ALIASES.get(raw.strip())


def _resolve_tracker_actor(db: Session, tracker_user_raw: str | None, fallback: User) -> User:
    return UserRepository(db).resolve_tracker_actor(tracker_user_raw, fallback)


def _webhook_fallback_user(db: Session) -> User:
    return UserRepository(db).get_webhook_fallback_user()


def _post_tracker_comment(
    repair_request: RepairRequest,
    text: str,
    *,
    log_event: str,
) -> None:
    issue_ref = (repair_request.tracker_ticket_key or repair_request.tracker_ticket_id or "").strip()
    if not issue_ref:
        return
    try:
        post_issue_comment(issue_ref, text)
    except TrackerUnavailableError as exc:
        logger.warning(
            "tracker_%s_comment_failed issue_ref=%s: %s",
            log_event,
            issue_ref,
            exc.message,
        )


def _reopen_from_closed(db: Session, repair_request: RepairRequest) -> None:
    repair_request.closed_at = None
    repair_request.closed_by_user_id = None
    device = (
        DeviceRepository(db).get_by_id(repair_request.device_id)
        if repair_request.device_id is not None
        else None
    )
    if device is not None:
        device.repair_status = RepairStatus.IN_REPAIR


def _apply_publish_flag(db: Session, repair_request: RepairRequest, is_published: bool) -> bool:
    if repair_request.is_published == is_published:
        return False
    repair_request.is_published = is_published
    note = (
        "Публикация для гостей: включена"
        if is_published
        else "Публикация для гостей: снята"
    )
    add_repair_history(
        db,
        device_id=repair_request.device_id,
        repair_request_id=repair_request.id,
        old_status=None,
        new_status=None,
        note=note,
    )
    return True


def _commit_publish_webhook(
    db: Session,
    repair_request: RepairRequest,
    *,
    is_published: bool,
) -> YandexTrackerWebhookResponse:
    db.commit()
    notify_repair_request_updated(repair_request, source="tracker_webhook_publish")
    comment = PUBLISH_TRACKER_COMMENT if is_published else UNPUBLISH_TRACKER_COMMENT
    _post_tracker_comment(repair_request, comment, log_event="publish")
    return YandexTrackerWebhookResponse(
        status="published" if is_published else "unpublished",
        repair_request_id=str(repair_request.id),
        detail=None,
        request_status=repair_request.status.value,
        closed_by_login=None,
        is_published=repair_request.is_published,
    )


def handle_tracker_status_webhook(
    db: Session,
    payload: YandexTrackerWebhookPayload,
) -> YandexTrackerWebhookResponse:
    repair_request = find_repair_request_for_tracker(db, payload.issue_key, payload.issue_id)

    key = (payload.issue_key or "").strip()
    iid = (payload.issue_id or "").strip()
    raw_status = (payload.tracker_status or "").strip()
    logger.info(
        "tracker_webhook_status issue=%s id=%s raw_status=%r db_status=%s db_label=%r",
        key or None,
        iid or None,
        raw_status or None,
        repair_request.status.value,
        repair_request.tracker_status_label,
    )
    if not raw_status:
        return YandexTrackerWebhookResponse(
            status="noop",
            repair_request_id=str(repair_request.id),
            detail="missing_tracker_status",
            request_status=repair_request.status.value,
            closed_by_login=None,
        )

    mapped = _map_tracker_status_to_request(raw_status)
    if mapped is None:
        logger.warning("tracker_webhook_unmapped_status issue=%s raw=%r", key or iid, raw_status)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "unmapped_tracker_status", "value": raw_status},
        )
    target = mapped

    if repair_request.status == target:
        current_label = (repair_request.tracker_status_label or "").strip()
        if current_label == raw_status:
            logger.info(
                "tracker_webhook_noop issue=%s status=%s label=%r",
                key or iid,
                repair_request.status.value,
                raw_status,
            )
            return YandexTrackerWebhookResponse(
                status="noop",
                repair_request_id=str(repair_request.id),
                detail="already_in_target_status",
                request_status=repair_request.status.value,
                closed_by_login=None,
            )
        repair_request.tracker_status_label = raw_status
        add_repair_history(
            db,
            device_id=repair_request.device_id,
            repair_request_id=repair_request.id,
            old_status=None,
            new_status=None,
            note=f"Статус из Трекера: {raw_status}",
        )
        db.commit()
        notify_repair_request_updated(repair_request, source="tracker_webhook")
        return YandexTrackerWebhookResponse(
            status="updated",
            repair_request_id=str(repair_request.id),
            detail="tracker_status_label_updated",
            request_status=repair_request.status.value,
            closed_by_login=None,
        )

    assert_can_transition(repair_request.status, target, TransitionSource.WEBHOOK)

    if target == RequestStatus.CLOSED:
        fallback = _webhook_fallback_user(db)
        closer = _resolve_tracker_actor(db, payload.user, fallback)
        record_repair_request_closed(
            db,
            repair_request,
            closer,
            payload.resolution,
            payload.resolution_desc,
        )
        repair_request.tracker_status_label = raw_status
        db.commit()
        notify_repair_request_updated(repair_request, source="tracker_webhook")
        _post_tracker_comment(
            repair_request,
            tracker_comment_status_sync(raw_status),
            log_event="status_sync",
        )
        return YandexTrackerWebhookResponse(
            status="closed",
            repair_request_id=str(repair_request.id),
            detail=None,
            request_status=RequestStatus.CLOSED.value,
            closed_by_login=closer.login,
        )

    if repair_request.status == RequestStatus.CLOSED:
        _reopen_from_closed(db, repair_request)

    repair_request.status = target
    repair_request.tracker_status_label = raw_status
    if payload.resolution is not None:
        repair_request.resolution_note = payload.resolution
    if payload.resolution_desc is not None:
        repair_request.resolution_desc = payload.resolution_desc
    add_repair_history(
        db,
        device_id=repair_request.device_id,
        repair_request_id=repair_request.id,
        old_status=None,
        new_status=None,
        note=f"Статус из Трекера: {raw_status}",
    )
    db.commit()
    notify_repair_request_updated(repair_request, source="tracker_webhook")
    _post_tracker_comment(
        repair_request,
        tracker_comment_status_sync(raw_status),
        log_event="status_sync",
    )
    return YandexTrackerWebhookResponse(
        status="updated",
        repair_request_id=str(repair_request.id),
        detail=None,
        request_status=target.value,
        closed_by_login=None,
    )


def handle_tracker_publish_webhook(
    db: Session,
    payload: YandexTrackerPublishPayload,
) -> YandexTrackerWebhookResponse:
    repair_request = find_repair_request_for_tracker(db, payload.issue_key, payload.issue_id)
    rid = str(repair_request.id)
    if repair_request.is_published == payload.is_published:
        return YandexTrackerWebhookResponse(
            status="noop",
            repair_request_id=rid,
            detail="already_published" if payload.is_published else "already_unpublished",
            request_status=repair_request.status.value,
            closed_by_login=None,
            is_published=repair_request.is_published,
        )
    _apply_publish_flag(db, repair_request, payload.is_published)
    return _commit_publish_webhook(db, repair_request, is_published=payload.is_published)


def handle_tracker_comment_webhook(
    db: Session,
    payload: YandexTrackerCommentPayload,
) -> YandexTrackerWebhookResponse:
    repair_request = find_repair_request_for_tracker(db, payload.issue_key, payload.issue_id)
    text = (payload.comment_text or "").strip()
    if not text:
        return YandexTrackerWebhookResponse(
            status="noop",
            repair_request_id=str(repair_request.id),
            detail="missing_comment_text",
            request_status=repair_request.status.value,
        )

    fallback = _webhook_fallback_user(db)
    author = _resolve_tracker_actor(db, payload.user, fallback)
    author_label = (payload.author or payload.user or "").strip() or None

    outcome = create_comment_from_tracker(
        db,
        repair_request,
        author,
        text,
        tracker_comment_id=(payload.comment_id or "").strip() or None,
        author_label=author_label,
        webhook_actor_login=fallback.login,
    )
    if outcome != "created":
        return YandexTrackerWebhookResponse(
            status="noop",
            repair_request_id=str(repair_request.id),
            detail=outcome,
            request_status=repair_request.status.value,
        )

    notify_repair_request_updated(repair_request, source="tracker_webhook_comment")
    return YandexTrackerWebhookResponse(
        status="created",
        repair_request_id=str(repair_request.id),
        detail=None,
        request_status=repair_request.status.value,
    )


def handle_tracker_sysadmin_taken_webhook(
    db: Session,
    payload: YandexTrackerSysadminTakenPayload,
) -> YandexTrackerWebhookResponse:
    repair_request = find_repair_request_for_tracker(db, payload.issue_key, payload.issue_id)

    if repair_request.status == RequestStatus.CLOSED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="repair_request_closed",
        )

    rid = str(repair_request.id)
    already_taken = repair_request.taken_by_sysadmin_at is not None

    if payload.sysadmin_taken:
        if already_taken:
            return YandexTrackerWebhookResponse(
                status="noop",
                repair_request_id=rid,
                detail="already_taken_by_sysadmin",
                request_status=repair_request.status.value,
                taken_by_sysadmin=True,
            )
        actor = _resolve_tracker_actor(db, payload.user, _webhook_fallback_user(db))
        record_sysadmin_taken(db, repair_request, actor)
        db.commit()
        notify_repair_request_updated(repair_request, source="tracker_webhook_sysadmin")
        _post_tracker_comment(
            repair_request,
            SYSADMIN_TAKEN_TRACKER_COMMENT,
            log_event="sysadmin_taken",
        )
        return YandexTrackerWebhookResponse(
            status="updated",
            repair_request_id=rid,
            detail=None,
            request_status=repair_request.status.value,
            taken_by_sysadmin=True,
        )

    if not already_taken:
        return YandexTrackerWebhookResponse(
            status="noop",
            repair_request_id=rid,
            detail="not_taken_by_sysadmin",
            request_status=repair_request.status.value,
            taken_by_sysadmin=False,
        )
    record_sysadmin_returned(db, repair_request)
    db.commit()
    notify_repair_request_updated(repair_request, source="tracker_webhook_sysadmin")
    _post_tracker_comment(
        repair_request,
        SYSADMIN_RETURNED_TRACKER_COMMENT,
        log_event="sysadmin_returned",
    )
    return YandexTrackerWebhookResponse(
        status="updated",
        repair_request_id=rid,
        detail=None,
        request_status=repair_request.status.value,
        taken_by_sysadmin=False,
    )
