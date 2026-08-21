"""Обработка входящих вебхуков Jira Automation."""

from __future__ import annotations

import hmac
import logging

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.integrations.jira.status_map import map_jira_status_to_request
from backend.app.integrations.registry import external_tracker_enabled, get_issue_tracker
from backend.app.integrations.types import IssueTrackerUnavailableError
from backend.app.models.enums import RequestStatus
from backend.app.models.repair_request import RepairRequest
from backend.app.repositories.repair_request_repository import (
    find_repair_request_for_tracker,
)
from backend.app.repositories.user_repository import UserRepository
from backend.app.schemas.jira_webhook import (
    JiraWebhookCommentPayload,
    JiraWebhookResponse,
    JiraWebhookStatusPayload,
)
from backend.app.services.repair_history_service import add_repair_history
from backend.app.services.repair_request_closure_service import (
    record_repair_request_closed,
)
from backend.app.services.repair_request_tracker_comment_inbound import (
    create_comment_from_tracker,
)
from backend.app.services.repair_request_transitions import (
    TransitionSource,
    assert_can_transition,
)
from backend.app.services.realtime_notify import notify_repair_request_updated
from backend.app.services.repair_request_webhook_service import (
    _reopen_from_closed,
    _resolve_tracker_actor,
    _webhook_fallback_user,
)

logger = logging.getLogger(__name__)

JIRA_WEBHOOK_SECRET_HEADER = "X-Jira-Webhook-Secret"


def verify_jira_webhook_secret(header_value: str | None) -> None:
    expected = (settings.server.jira_webhook_secret or "").strip()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="jira_webhook_not_configured",
        )
    if not header_value:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="missing_jira_webhook_secret",
        )
    a = header_value.encode("utf-8")
    b = expected.encode("utf-8")
    if len(a) != len(b) or not hmac.compare_digest(a, b):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_jira_webhook_secret",
        )


def _jira_status_sync_comment(jira_status_label: str) -> str:
    label = (jira_status_label or "").strip() or "—"
    return f"[Fix My Kit] Синхронизирован статус заявки: {label}"


def _post_jira_echo_comment(
    repair_request: RepairRequest,
    text: str,
    *,
    log_event: str,
) -> None:
    if not external_tracker_enabled():
        return
    issue_ref = (
        repair_request.tracker_ticket_key or repair_request.tracker_ticket_id or ""
    ).strip()
    if not issue_ref:
        return
    try:
        get_issue_tracker().add_comment(repair_request, text, markup_md=False)
    except IssueTrackerUnavailableError as exc:
        logger.warning(
            "jira_%s_comment_failed issue_ref=%s: %s",
            log_event,
            issue_ref,
            exc.message,
        )


def handle_jira_status_webhook(
    db: Session,
    payload: JiraWebhookStatusPayload,
) -> JiraWebhookResponse:
    repair_request = find_repair_request_for_tracker(
        db, payload.issue_key, payload.issue_id
    )

    key = (payload.issue_key or "").strip()
    iid = (payload.issue_id or "").strip()
    raw_status = (payload.jira_status or "").strip()
    logger.info(
        "jira_webhook_status issue=%s id=%s raw_status=%r db_status=%s db_label=%r",
        key or None,
        iid or None,
        raw_status or None,
        repair_request.status.value,
        repair_request.tracker_status_label,
    )
    if not raw_status:
        return JiraWebhookResponse(
            status="noop",
            repair_request_id=str(repair_request.id),
            detail="missing_jira_status",
            request_status=repair_request.status.value,
            closed_by_login=None,
        )

    mapped = map_jira_status_to_request(raw_status)
    if mapped is None:
        logger.warning(
            "jira_webhook_unmapped_status issue=%s raw=%r", key or iid, raw_status
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "unmapped_jira_status", "value": raw_status},
        )
    target = mapped

    if repair_request.status == target:
        current_label = (repair_request.tracker_status_label or "").strip()
        if current_label == raw_status:
            logger.info(
                "jira_webhook_noop issue=%s status=%s label=%r",
                key or iid,
                repair_request.status.value,
                raw_status,
            )
            return JiraWebhookResponse(
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
            note=f"Статус из Jira: {raw_status}",
        )
        db.commit()
        notify_repair_request_updated(repair_request, source="jira_webhook")
        return JiraWebhookResponse(
            status="updated",
            repair_request_id=str(repair_request.id),
            detail="jira_status_label_updated",
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
        notify_repair_request_updated(repair_request, source="jira_webhook")
        _post_jira_echo_comment(
            repair_request,
            _jira_status_sync_comment(raw_status),
            log_event="status_sync",
        )
        return JiraWebhookResponse(
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
        note=f"Статус из Jira: {raw_status}",
    )
    db.commit()
    notify_repair_request_updated(repair_request, source="jira_webhook")
    _post_jira_echo_comment(
        repair_request,
        _jira_status_sync_comment(raw_status),
        log_event="status_sync",
    )
    return JiraWebhookResponse(
        status="updated",
        repair_request_id=str(repair_request.id),
        detail=None,
        request_status=target.value,
        closed_by_login=None,
    )


def handle_jira_comment_webhook(
    db: Session,
    payload: JiraWebhookCommentPayload,
) -> JiraWebhookResponse:
    repair_request = find_repair_request_for_tracker(
        db, payload.issue_key, payload.issue_id
    )
    text = (payload.comment_text or "").strip()
    if not text:
        return JiraWebhookResponse(
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
        return JiraWebhookResponse(
            status="noop",
            repair_request_id=str(repair_request.id),
            detail=outcome,
            request_status=repair_request.status.value,
        )

    notify_repair_request_updated(repair_request, source="jira_webhook_comment")
    return JiraWebhookResponse(
        status="created",
        repair_request_id=str(repair_request.id),
        detail=None,
        request_status=repair_request.status.value,
    )
