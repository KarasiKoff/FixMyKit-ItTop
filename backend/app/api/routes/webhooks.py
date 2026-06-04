"""Входящие HTTP-вызовы из триггеров Yandex Tracker."""

from typing import Annotated

from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from backend.app.api.deps import get_db
from backend.app.schemas.tracker_webhook import (
    YandexTrackerCommentPayload,
    YandexTrackerPublishPayload,
    YandexTrackerSysadminTakenPayload,
    YandexTrackerWebhookPayload,
    YandexTrackerWebhookResponse,
)
from backend.app.services.repair_request_webhook_service import (
    TRACKER_STATUS_ALIASES,
    TRACKER_WEBHOOK_SECRET_HEADER,
    handle_tracker_comment_webhook,
    handle_tracker_publish_webhook,
    handle_tracker_status_webhook,
    handle_tracker_sysadmin_taken_webhook,
    verify_webhook_secret,
)

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

# Для OpenAPI / описаний в роутере
__all__ = ["router", "TRACKER_WEBHOOK_SECRET_HEADER", "TRACKER_STATUS_ALIASES"]


@router.post(
    "/yandex-tracker",
    response_model=YandexTrackerWebhookResponse,
    summary="Синхронизация заявки по событию из Yandex Tracker",
    description=(
        "Один URL. В JSON: `tracker_status` = `{{issue.status}}` — строка как в Трекере, "
        "точное совпадение с ключами в `TRACKER_STATUS_ALIASES`. "
        "Пустой `tracker_status` — noop. Закрытие только при статусе «Закрыт». "
        "Публикация — отдельный URL `/yandex-tracker/publish` "
        f"Заголовок `{TRACKER_WEBHOOK_SECRET_HEADER}` = `TRACKER_WEBHOOK_SECRET`."
    ),
)
def yandex_tracker_close_repair_request(
    payload: YandexTrackerWebhookPayload,
    db: Session = Depends(get_db),
    x_tracker_webhook_secret: Annotated[
        str | None, Header(alias=TRACKER_WEBHOOK_SECRET_HEADER)
    ] = None,
) -> YandexTrackerWebhookResponse:
    verify_webhook_secret(x_tracker_webhook_secret)
    return handle_tracker_status_webhook(db, payload)


@router.post(
    "/yandex-tracker/publish",
    response_model=YandexTrackerWebhookResponse,
    summary="Публикация / снятие с публикации из Yandex Tracker",
    description=(
        "Отдельный триггер по макросу: только `is_published` true/false. "
        "После успеха в задачу пишется красный комментарий от TRACKER_TOKEN."
    ),
)
def yandex_tracker_publish(
    payload: YandexTrackerPublishPayload,
    db: Session = Depends(get_db),
    x_tracker_webhook_secret: Annotated[
        str | None, Header(alias=TRACKER_WEBHOOK_SECRET_HEADER)
    ] = None,
) -> YandexTrackerWebhookResponse:
    verify_webhook_secret(x_tracker_webhook_secret)
    return handle_tracker_publish_webhook(db, payload)


@router.post(
    "/yandex-tracker/comment",
    response_model=YandexTrackerWebhookResponse,
    summary="Комментарий из Yandex Tracker в ленту на сайте",
    description=(
        "Отдельный триггер при добавлении комментария к задаче. "
        "В JSON: `comment_text` = `{{userComment.text}}`, `comment_id` = `{{userComment.id}}`. "
        "Комментарии, созданные Fix My Kit в Трекере, игнорируются."
    ),
)
def yandex_tracker_comment(
    payload: YandexTrackerCommentPayload,
    db: Session = Depends(get_db),
    x_tracker_webhook_secret: Annotated[
        str | None, Header(alias=TRACKER_WEBHOOK_SECRET_HEADER)
    ] = None,
) -> YandexTrackerWebhookResponse:
    verify_webhook_secret(x_tracker_webhook_secret)
    return handle_tracker_comment_webhook(db, payload)


@router.post(
    "/yandex-tracker/sysadmin-taken",
    response_model=YandexTrackerWebhookResponse,
    summary="Отметка «забрал / вернул сисадмин» из Yandex Tracker",
    description=(
        "Отдельный триггер по макросу. "
        "После успешной отметки в БД в задачу пишется комментарий от TRACKER_TOKEN"
    ),
)
def yandex_tracker_sysadmin_taken(
    payload: YandexTrackerSysadminTakenPayload,
    db: Session = Depends(get_db),
    x_tracker_webhook_secret: Annotated[
        str | None, Header(alias=TRACKER_WEBHOOK_SECRET_HEADER)
    ] = None,
) -> YandexTrackerWebhookResponse:
    verify_webhook_secret(x_tracker_webhook_secret)
    return handle_tracker_sysadmin_taken_webhook(db, payload)
