"""Массовая синхронизация заявок без привязки к Tracker."""

from __future__ import annotations

from sqlalchemy.orm import Session

from backend.app.repositories.repair_request_repository import RepairRequestRepository
from backend.app.schemas.tracker import TrackerBulkSyncResponse
from backend.app.services.repair_request_tracker_sync import try_tracker_sync


def sync_unsynchronized_repair_requests(db: Session) -> TrackerBulkSyncResponse:
    ids = RepairRequestRepository(db).list_ids_without_tracker()
    attempted = len(ids)
    synced = 0
    failed = 0
    for rid in ids:
        if try_tracker_sync(rid):
            synced += 1
        else:
            failed += 1
    return TrackerBulkSyncResponse(attempted=attempted, synced=synced, failed=failed)
