"""Импорт комментариев из Yandex Tracker в ленту заявки на сайте."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from backend.app.models.repair_request import RepairRequest
from backend.app.models.repair_request_comment import RepairRequestComment
from backend.app.models.user import User

# Комментарии, которые сайт сам пишет в Tracker — не импортируем обратно.
_TRACKER_ECHO_MARKERS = (
    "(Fix My Kit):",
    "Статус изменён в Fix My Kit",
    "В Fix My Kit ",
    "**Резолюция:**",
)


def should_skip_tracker_inbound_comment(text: str) -> bool:
    body = (text or "").strip()
    if not body:
        return True
    return any(marker in body for marker in _TRACKER_ECHO_MARKERS)


def _format_inbound_body(text: str, author_label: str | None, *, use_prefix: bool) -> str:
    body = text.strip()
    if not use_prefix or not author_label:
        return body
    label = author_label.strip()
    if not label:
        return body
    return f"**{label}**:\n\n{body}"


def find_existing_tracker_comment(
    db: Session,
    repair_request_id: UUID,
    tracker_comment_id: str,
) -> RepairRequestComment | None:
    return (
        db.query(RepairRequestComment)
        .filter(
            RepairRequestComment.repair_request_id == repair_request_id,
            RepairRequestComment.tracker_comment_id == tracker_comment_id,
        )
        .first()
    )


def create_comment_from_tracker(
    db: Session,
    repair_request: RepairRequest,
    author: User,
    body: str,
    *,
    tracker_comment_id: str | None = None,
    author_label: str | None = None,
    webhook_actor_login: str,
) -> str:
    """
    Сохраняет комментарий из Трекера без исходящей синхронизации.
    Возвращает: created | skipped_echo | duplicate.
    """
    if should_skip_tracker_inbound_comment(body):
        return "skipped_echo"

    tid = (tracker_comment_id or "").strip() or None
    if tid is not None:
        existing = find_existing_tracker_comment(db, repair_request.id, tid)
        if existing is not None:
            return "duplicate"

    use_prefix = author.login == webhook_actor_login
    stored_body = _format_inbound_body(body, author_label, use_prefix=use_prefix)

    row = RepairRequestComment(
        repair_request_id=repair_request.id,
        author_user_id=author.id,
        body=stored_body,
        tracker_comment_id=tid,
        tracker_synced=True,
    )
    db.add(row)
    db.commit()
    return "created"
