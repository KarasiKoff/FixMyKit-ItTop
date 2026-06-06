"""Публичная сводка заявок не раскрывает ФИО заявителя."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from backend.app.models.enums import RequestStatus
from backend.app.models.repair_request import RepairRequest
from backend.app.services.public_repair_summary_service import (
    summarize_public_repair_requests,
)


def _request(
    *,
    status: RequestStatus,
    is_published: bool,
    description: str = "Не работает монитор",
    applicant_name: str = "Иван Иванов",
    resolution_note: str = "Решен",
) -> RepairRequest:
    now = datetime.now(UTC)
    return RepairRequest(
        id=uuid4(),
        device_id=uuid4(),
        description=description,
        applicant_name=applicant_name,
        status=status,
        is_published=is_published,
        resolution_note=resolution_note,
        created_at=now,
        closed_at=now if status == RequestStatus.CLOSED else None,
    )


def test_published_active_request_hides_applicant_name_only() -> None:
    active, has_unpublished, history = summarize_public_repair_requests(
        [_request(status=RequestStatus.IN_PROGRESS, is_published=True)],
    )

    assert has_unpublished is False
    assert history == []
    assert active is not None
    assert active.description == "Не работает монитор"
    assert not hasattr(active, "applicant_name")
    dumped = active.model_dump()
    assert "applicant_name" not in dumped
    assert dumped["description"] == "Не работает монитор"


def test_unpublished_active_request_hidden_from_public() -> None:
    active, has_unpublished, history = summarize_public_repair_requests(
        [_request(status=RequestStatus.OPEN, is_published=False)],
    )

    assert active is None
    assert has_unpublished is True
    assert history == []


def test_closed_published_history_keeps_description_and_resolution() -> None:
    active, has_unpublished, history = summarize_public_repair_requests(
        [_request(status=RequestStatus.CLOSED, is_published=True)],
    )

    assert active is None
    assert has_unpublished is False
    assert len(history) == 1
    dumped = history[0].model_dump()
    assert dumped["description"] == "Не работает монитор"
    assert dumped["resolution_note"] == "Решен"
    assert "applicant_name" not in dumped
