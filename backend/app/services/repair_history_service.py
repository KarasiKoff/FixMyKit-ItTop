from uuid import UUID

from sqlalchemy.orm import Session

from backend.app.models.enums import RepairStatus
from backend.app.models.repair_history import RepairHistory


def add_repair_history(
    db: Session,
    *,
    device_id: UUID,
    repair_request_id: UUID | None = None,
    old_status: RepairStatus | None = None,
    new_status: RepairStatus | None = None,
    note: str | None = None,
) -> None:
    db.add(
        RepairHistory(
            device_id=device_id,
            repair_request_id=repair_request_id,
            old_status=old_status,
            new_status=new_status,
            note=note,
        )
    )
