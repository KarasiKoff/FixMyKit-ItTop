"""Сериализация заявок в ответы API (audience_name, device_name)."""

from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

from backend.app.models.enums import AttachmentsSyncStatus, RequestStatus
from backend.app.services.repair_request_presenters import (
    repair_request_to_list_response,
)


def _repair_request_stub(**overrides: object) -> SimpleNamespace:
    now = datetime.now(timezone.utc)
    base = {
        "id": uuid4(),
        "device_id": None,
        "audience_id": uuid4(),
        "author_user_id": None,
        "closed_by_user_id": None,
        "taken_by_sysadmin_by_user_id": None,
        "applicant_name": "admin",
        "description": "test",
        "status": RequestStatus.IN_PROGRESS,
        "is_published": False,
        "taken_by_sysadmin_at": None,
        "resolution_note": None,
        "resolution_desc": None,
        "closed_at": None,
        "tracker_ticket_id": "1",
        "tracker_ticket_key": "FIX-1",
        "tracker_ticket_url": None,
        "tracker_status_label": "В работе",
        "tracker_status_sync_pending": False,
        "last_sync_at": None,
        "has_attachments": False,
        "attachments_sync_status": AttachmentsSyncStatus.NONE,
        "attachments_count": 0,
        "attachments_synced_count": 0,
        "created_at": now,
        "updated_at": now,
        "device": None,
        "audience": SimpleNamespace(name="Кабинет 300"),
    }
    base.update(overrides)
    return SimpleNamespace(**base)


class TestRepairRequestToListResponse:
    def test_audience_name_from_relation(self) -> None:
        item = _repair_request_stub()
        response = repair_request_to_list_response(item)  # type: ignore[arg-type]
        assert response.audience_name == "Кабинет 300"

    def test_without_audience_relation_no_name(self) -> None:
        item = _repair_request_stub(audience=None)
        response = repair_request_to_list_response(item)  # type: ignore[arg-type]
        assert response.audience_name is None

    def test_device_name_from_relation(self) -> None:
        item = _repair_request_stub(
            audience_id=None,
            audience=None,
            device_id=uuid4(),
            device=SimpleNamespace(inventory_number="INV-1", name="Принтер"),
        )
        response = repair_request_to_list_response(item)  # type: ignore[arg-type]
        assert response.device_name == "Принтер"
        assert response.device_inventory_number == "INV-1"
