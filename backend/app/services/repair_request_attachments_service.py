"""Список и скачивание вложений заявки из Yandex Tracker."""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.app.schemas.attachments import TrackerAttachmentItem, TrackerAttachmentList
from backend.app.services.repair_request_attachment_service import (
    tracker_attachment_kind,
)
from backend.app.repositories.repair_request_repository import get_repair_request_or_404
from backend.app.services.tracker_service import (
    TrackerUnavailableError,
    fetch_attachment_content,
    issue_ref_for,
    list_issue_attachments,
)


def list_tracker_attachments(db: Session, request_id: UUID) -> TrackerAttachmentList:
    repair_request = get_repair_request_or_404(db, request_id, for_tracker=True)
    if not issue_ref_for(repair_request):
        return TrackerAttachmentList(items=[])
    try:
        rows = list_issue_attachments(repair_request)
    except TrackerUnavailableError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="tracker_unavailable",
        ) from None
    items = [
        TrackerAttachmentItem(
            id=row.id,
            name=row.name,
            kind=tracker_attachment_kind(row.mimetype, row.name),
            mimetype=row.mimetype,
            size=row.size,
            has_thumbnail=bool(row.thumbnail_url),
            created_at=row.created_at,
        )
        for row in rows
    ]
    return TrackerAttachmentList(items=items)


def fetch_tracker_attachment_bytes(
    db: Session,
    request_id: UUID,
    attachment_id: str,
    *,
    variant: Literal["content", "thumbnail"] = "content",
) -> tuple[bytes, str]:
    repair_request = get_repair_request_or_404(db, request_id, for_tracker=True)
    try:
        data, content_type = fetch_attachment_content(
            repair_request,
            attachment_id,
            variant=variant,
        )
    except TrackerUnavailableError as exc:
        if "not_found" in exc.message:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="attachment_not_found",
            ) from None
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="tracker_unavailable",
        ) from None
    media = (content_type or "application/octet-stream").split(";")[0]
    return data, media
