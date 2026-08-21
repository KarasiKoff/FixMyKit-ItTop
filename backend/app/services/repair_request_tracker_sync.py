"""Синхронизация заявки с Tracker в фоновом потоке (отдельная DB-сессия)."""

from __future__ import annotations

from uuid import UUID

from backend.app.core.database import SessionLocal
from backend.app.repositories.repair_request_repository import RepairRequestRepository
from backend.app.integrations.registry import external_tracker_enabled
from backend.app.services.repair_request_attachment_service import (
    sync_external_issue_and_attachments,
)


def try_external_sync(request_id: UUID) -> bool:
    """Потокобезопасный вызов: своя Session на поток."""
    if not external_tracker_enabled():
        return True
    db = SessionLocal()
    try:
        repair_request = RepairRequestRepository(db).get_for_tracker(request_id)
        if repair_request is None:
            return False
        ok, _ = sync_external_issue_and_attachments(db, repair_request)
        return ok
    finally:
        db.close()


def try_tracker_sync(request_id: UUID) -> bool:
    """Обратная совместимость."""
    return try_external_sync(request_id)
