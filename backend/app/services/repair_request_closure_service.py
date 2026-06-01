"""Закрытие заявки на ремонт: статус, устройство, история (для API и вебхука Yandex Tracker)"""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from backend.app.models.device import Device
from backend.app.models.enums import RepairStatus, RequestStatus
from backend.app.models.repair_request import RepairRequest
from backend.app.models.user import User
from backend.app.services.repair_history_service import add_repair_history
from backend.app.services.repair_request_sysadmin_taken_service import (
    clear_sysadmin_taken_fields,
)


def apply_closed_fields(
    repair_request: RepairRequest,
    closed_by: User,
    resolution_note: str | None = None,
    resolution_desc: str | None = None,
) -> None:
    repair_request.status = RequestStatus.CLOSED
    repair_request.closed_at = datetime.now(timezone.utc)
    repair_request.closed_by_user_id = closed_by.id
    if resolution_note is not None:
        repair_request.resolution_note = resolution_note
    if resolution_desc is not None:
        repair_request.resolution_desc = resolution_desc
    clear_sysadmin_taken_fields(repair_request)


def record_repair_request_closed(
    db: Session,
    repair_request: RepairRequest,
    closed_by: User,
    resolution_note: str | None,
    resolution_desc: str | None = None,
) -> None:
    device = db.query(Device).filter(Device.id == repair_request.device_id).first()
    old_rs = device.repair_status if device else None
    apply_closed_fields(repair_request, closed_by, resolution_note, resolution_desc)
    if device is not None:
        device.repair_status = RepairStatus.NOT_IN_REPAIR
        add_repair_history(
            db,
            device_id=device.id,
            repair_request_id=repair_request.id,
            old_status=old_rs,
            new_status=RepairStatus.NOT_IN_REPAIR,
            note="Заявка закрыта",
        )
