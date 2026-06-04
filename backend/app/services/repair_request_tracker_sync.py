"""Синхронизация заявки с Tracker в фоновом потоке (отдельная DB-сессия)."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from backend.app.core.database import SessionLocal
from backend.app.models.device import Device
from backend.app.models.repair_request import RepairRequest
from backend.app.services.repair_request_attachment_service import sync_tracker_issue_and_attachments


def _load_for_tracker(db: Session, request_id: UUID) -> RepairRequest | None:
    return (
        db.query(RepairRequest)
        .filter(RepairRequest.id == request_id)
        .options(
            joinedload(RepairRequest.device).joinedload(Device.audience),
            joinedload(RepairRequest.audience),
            joinedload(RepairRequest.author),
        )
        .first()
    )


def try_tracker_sync(request_id: UUID) -> bool:
    """Потокобезопасный вызов: своя Session на поток."""
    db = SessionLocal()
    try:
        repair_request = _load_for_tracker(db, request_id)
        if repair_request is None:
            return False
        return sync_tracker_issue_and_attachments(db, repair_request)
    finally:
        db.close()
