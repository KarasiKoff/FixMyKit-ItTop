"""Контракт TrackerHttpClient: FakeTrackerClient подходит для TrackerIssueService."""

from tests.support.fake_tracker_client import FakeTrackerClient, tracker_create_issue_client
from backend.app.services.tracker_issue_service import TrackerIssueService


def test_fake_client_works_with_issue_service() -> None:
    fake = tracker_create_issue_client(key="FIX-42", ticket_id="99")
    service = TrackerIssueService(fake)
    creds = service.credentials()
    assert creds.queue == "FIX"
    assert creds.base_url.endswith("tracker.test")


def test_fake_tracker_is_tracker_client_subclass() -> None:
    assert isinstance(FakeTrackerClient(), FakeTrackerClient)
