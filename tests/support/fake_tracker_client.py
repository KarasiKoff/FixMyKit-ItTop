"""Fake TrackerClient и хелперы для pytest."""

from __future__ import annotations

from dataclasses import dataclass, field

import pytest

from backend.app.clients.tracker_client import TrackerClient, TrackerCredentials, TrackerUnavailableError
from backend.app.services.tracker_issue_service import TrackerIssueService

TRACKER_TEST_BASE = "https://tracker.test"


@dataclass
class FakeTrackerClient(TrackerClient):
    """Подмена HTTP: ответы задаются в тесте, вызовы накапливаются в `calls`."""

    json_responses: dict[tuple[str, str], dict] = field(default_factory=dict)
    list_responses: dict[tuple[str, str], list] = field(default_factory=dict)
    bytes_responses: dict[tuple[str, str], tuple[bytes, str | None]] = field(default_factory=dict)
    calls: list[tuple[str, str, dict | None]] = field(default_factory=list)
    fail_on_request_json: bool = False

    def credentials(self) -> TrackerCredentials:
        return TrackerCredentials(
            base_url=TRACKER_TEST_BASE,
            token="test-token",
            org_id="org-test",
            queue="FIX",
        )

    def request_json(self, method: str, url: str, *, data: dict | None = None) -> dict:
        self.calls.append((method, url, data))
        if self.fail_on_request_json:
            raise TrackerUnavailableError("tracker_unavailable_test")
        key = (method.upper(), url)
        if key in self.json_responses:
            return self.json_responses[key]
        return {"key": "FIX-1", "id": "1"}

    def request_json_list(self, method: str, url: str) -> list:
        self.calls.append((method, url, None))
        key = (method.upper(), url)
        if key in self.list_responses:
            return self.list_responses[key]
        return []

    def request_bytes(
        self,
        method: str,
        url: str,
        *,
        data: bytes | None = None,
        headers_extra: dict[str, str] | None = None,
        timeout_seconds: int | None = None,
    ) -> tuple[bytes, str | None]:
        self.calls.append((method, url, None))
        key = (method.upper(), url)
        if key in self.bytes_responses:
            return self.bytes_responses[key]
        return b"", "application/octet-stream"


def tracker_create_issue_client(
    *,
    key: str = "FIX-99",
    ticket_id: str = "12345",
) -> FakeTrackerClient:
    base = TRACKER_TEST_BASE.rstrip("/")
    create_url = f"{base}/issues/"
    return FakeTrackerClient(
        json_responses={
            ("POST", create_url): {
                "id": ticket_id,
                "key": key,
                "self": f"{base}/issues/{key}",
            },
        },
        list_responses={
            ("GET", f"{base}/issues/{key}/attachments"): [],
        },
    )


def tracker_failing_client() -> FakeTrackerClient:
    return FakeTrackerClient(fail_on_request_json=True)


def patch_tracker_issue_service(
    monkeypatch: pytest.MonkeyPatch,
    client: FakeTrackerClient | None = None,
) -> FakeTrackerClient:
    """Подменяет singleton TrackerIssueService; возвращает FakeTrackerClient (calls)."""
    fake = client or tracker_create_issue_client()
    service = TrackerIssueService(fake)
    monkeypatch.setattr(
        "backend.app.services.tracker_issue_service.get_tracker_issue_service",
        lambda: service,
    )
    monkeypatch.setattr(
        "backend.app.services.tracker_service.get_tracker_issue_service",
        lambda: service,
    )
    return fake


def enable_real_try_tracker_sync(monkeypatch: pytest.MonkeyPatch) -> None:
    from backend.app.services.repair_request_tracker_sync import try_tracker_sync

    monkeypatch.setattr(
        "backend.app.services.repair_request_create_service.try_tracker_sync",
        try_tracker_sync,
    )
