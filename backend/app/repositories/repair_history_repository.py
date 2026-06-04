"""История ремонта устройства."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from backend.app.models.enums import RepairStatus
from backend.app.models.repair_history import RepairHistory


class RepairHistoryRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def add_entry(
        self,
        *,
        device_id: UUID,
        repair_request_id: UUID | None = None,
        old_status: RepairStatus | None = None,
        new_status: RepairStatus | None = None,
        note: str | None = None,
    ) -> None:
        self._db.add(
            RepairHistory(
                device_id=device_id,
                repair_request_id=repair_request_id,
                old_status=old_status,
                new_status=new_status,
                note=note,
            )
        )

    def list_for_device(self, device_id: UUID) -> list[RepairHistory]:
        return (
            self._db.query(RepairHistory)
            .options(joinedload(RepairHistory.repair_request))
            .filter(RepairHistory.device_id == device_id)
            .order_by(RepairHistory.created_at.desc())
            .all()
        )
