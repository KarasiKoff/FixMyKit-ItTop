"""Исходящая синхронизация статуса в Tracker (без HTTP)."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from backend.app.services.repair_request_tracker_outbound import (
    require_tracker_ticket,
    sync_tracker_label_with_pending,
)
from backend.app.services.tracker_service import TrackerUnavailableError


def _request_with_ticket(**overrides: object) -> SimpleNamespace:
    base = {
        "tracker_ticket_key": "FIX-99",
        "tracker_ticket_id": None,
        "tracker_status_sync_pending": False,
    }
    base.update(overrides)
    return SimpleNamespace(**base)


class TestRequireTrackerTicket:
    def test_returns_key(self) -> None:
        assert require_tracker_ticket(_request_with_ticket()) == "FIX-99"

    def test_falls_back_to_id(self) -> None:
        rr = _request_with_ticket(tracker_ticket_key=None, tracker_ticket_id="12345")
        assert require_tracker_ticket(rr) == "12345"

    def test_raises_409_when_missing(self) -> None:
        rr = _request_with_ticket(tracker_ticket_key=None, tracker_ticket_id=None)
        with pytest.raises(HTTPException) as exc:
            require_tracker_ticket(rr)
        assert exc.value.status_code == 409
        assert exc.value.detail == "tracker_ticket_required"


class TestSyncTrackerLabelWithPending:
    def test_clears_pending_on_success(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(
            "backend.app.services.repair_request_tracker_outbound.push_issue_status_from_site",
            lambda *args, **kwargs: None,
        )
        monkeypatch.setattr(
            "backend.app.services.repair_request_tracker_outbound.post_issue_comment",
            lambda *args, **kwargs: None,
        )
        db = MagicMock()
        rr = _request_with_ticket(tracker_status_sync_pending=True)
        sync_tracker_label_with_pending(db, rr, "В работе")
        assert rr.tracker_status_sync_pending is False
        db.commit.assert_called()

    def test_sets_pending_on_tracker_unavailable(self, monkeypatch: pytest.MonkeyPatch) -> None:
        def _fail(*args, **kwargs) -> None:
            raise TrackerUnavailableError("down")

        monkeypatch.setattr(
            "backend.app.services.repair_request_tracker_outbound.push_issue_status_from_site",
            _fail,
        )
        db = MagicMock()
        rr = _request_with_ticket()
        with pytest.raises(HTTPException) as exc:
            sync_tracker_label_with_pending(db, rr, "В работе")
        assert exc.value.status_code == 502
        assert exc.value.detail == "tracker_unavailable"
        assert rr.tracker_status_sync_pending is True
