"""Отметка «забрал сисадмин» по заявке (API и вебхук Yandex Tracker)."""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from backend.app.models.repair_request import RepairRequest
from backend.app.models.user import User
from backend.app.services.repair_history_service import add_repair_history


def clear_sysadmin_taken_fields(repair_request: RepairRequest) -> None:
    repair_request.taken_by_sysadmin_at = None
    repair_request.taken_by_sysadmin_by_user_id = None


def record_sysadmin_taken(
    db: Session,
    repair_request: RepairRequest,
    actor: User,
) -> None:
    repair_request.taken_by_sysadmin_at = datetime.now(timezone.utc)
    repair_request.taken_by_sysadmin_by_user_id = actor.id
    add_repair_history(
        db,
        device_id=repair_request.device_id,
        repair_request_id=repair_request.id,
        old_status=None,
        new_status=None,
        note="Отмечено: забрал системный администратор (Трекер)",
    )


def record_sysadmin_returned(db: Session, repair_request: RepairRequest) -> None:
    if (
        repair_request.taken_by_sysadmin_at is None
        and repair_request.taken_by_sysadmin_by_user_id is None
    ):
        return
    clear_sysadmin_taken_fields(repair_request)
    add_repair_history(
        db,
        device_id=repair_request.device_id,
        repair_request_id=repair_request.id,
        old_status=None,
        new_status=None,
        note="Снято: забрал системный администратор (Трекер)",
    )
