"""Массовая синхронизация заявок без привязки к Tracker."""

from __future__ import annotations

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from backend.app.models.repair_request import RepairRequest
from backend.app.schemas.tracker import TrackerBulkSyncResponse
from backend.app.services.repair_request_tracker_sync import try_tracker_sync


def sync_unsynchronized_repair_requests(db: Session) -> TrackerBulkSyncResponse:
    rows = (
        db.query(RepairRequest.id)
        .filter(
            and_(
                or_(RepairRequest.tracker_ticket_id.is_(None), RepairRequest.tracker_ticket_id == ""),
                or_(RepairRequest.tracker_ticket_key.is_(None), RepairRequest.tracker_ticket_key == ""),
            )
        )
        .order_by(RepairRequest.created_at.asc())
        .all()
    )
    attempted = len(rows)
    synced = 0
    failed = 0
    for (rid,) in rows:
        if try_tracker_sync(rid):
            synced += 1
        else:
            failed += 1
    return TrackerBulkSyncResponse(attempted=attempted, synced=synced, failed=failed)
