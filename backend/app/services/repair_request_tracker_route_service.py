"""Синхронизация одной заявки с Tracker (эндпоинт staff API)."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.app.schemas.tracker import TrackerSyncResponse
from backend.app.services.realtime_notify import notify_repair_request_updated
from backend.app.services.repair_request_attachment_service import sync_tracker_issue_and_attachments
from backend.app.repositories.repair_request_repository import get_repair_request_or_404


def sync_repair_request_with_tracker(db: Session, request_id: UUID) -> TrackerSyncResponse:
    repair_request = get_repair_request_or_404(db, request_id, for_tracker=True)
    if not sync_tracker_issue_and_attachments(db, repair_request):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="tracker_unavailable",
        ) from None
    db.refresh(repair_request)
    notify_repair_request_updated(repair_request, source="api")
    return TrackerSyncResponse(
        tracker_ticket_id=repair_request.tracker_ticket_id or "",
        tracker_ticket_key=repair_request.tracker_ticket_key or "",
        tracker_ticket_url=repair_request.tracker_ticket_url or "",
        last_sync_at=repair_request.last_sync_at or datetime.now(timezone.utc),
    )
