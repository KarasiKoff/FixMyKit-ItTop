"""Маппинг строк статуса Yandex Tracker в RequestStatus."""

from __future__ import annotations

import pytest

from backend.app.models.enums import RequestStatus
from backend.app.services.repair_request_webhook_service import (
    TRACKER_STATUS_ALIASES,
    _map_tracker_status_to_request,
)


class TestMapTrackerStatus:
    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            ("Открыт", RequestStatus.OPEN),
            ("В работе", RequestStatus.IN_PROGRESS),
            ("Требуется информация", RequestStatus.NEEDS_INFO),
            ("Закрыт", RequestStatus.CLOSED),
        ],
    )
    def test_known_aliases(self, raw: str, expected: RequestStatus) -> None:
        assert _map_tracker_status_to_request(raw) == expected
        assert TRACKER_STATUS_ALIASES[raw] == expected

    def test_strips_whitespace(self) -> None:
        assert (
            _map_tracker_status_to_request("  В работе  ") == RequestStatus.IN_PROGRESS
        )

    @pytest.mark.parametrize("raw", ["", "   ", None])
    def test_empty_returns_none(self, raw: str | None) -> None:
        assert _map_tracker_status_to_request(raw or "") is None

    def test_unknown_status_returns_none(self) -> None:
        assert _map_tracker_status_to_request("Какой-то новый статус") is None
