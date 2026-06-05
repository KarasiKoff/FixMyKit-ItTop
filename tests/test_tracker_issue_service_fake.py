"""TrackerIssueService + FakeTrackerClient без HTTP."""

from __future__ import annotations

from backend.app.models.repair_request import RepairRequest
from backend.app.services.tracker_issue_service import TrackerIssueService
from tests.support.fake_tracker_client import tracker_create_issue_client


def test_sync_repair_request_creates_issue_via_fake_client() -> None:
    client = tracker_create_issue_client(key="FIX-UNIT-1", ticket_id="42")
    service = TrackerIssueService(client)
    repair_request = RepairRequest(
        audience_id=None,
        description="Тест",
        applicant_name="Иван",
    )

    result = service.sync_repair_request(repair_request)

    assert result.ticket_key == "FIX-UNIT-1"
    assert result.ticket_id == "42"
    assert any(
        call[0] == "POST" and call[1].endswith("/issues/") for call in client.calls
    )
