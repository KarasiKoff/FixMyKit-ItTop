"""Fake JiraClient для pytest."""

from __future__ import annotations

from dataclasses import dataclass, field

import pytest

from backend.app.integrations.jira.client import (
    JIRA_PLATFORM_API,
    JiraClient,
    JiraCredentials,
)
from backend.app.integrations.jira.issue_service import JiraIssueService
from backend.app.integrations.types import IssueTrackerUnavailableError

JIRA_TEST_BASE = "https://jira.test"
JIRA_TEST_CLOUD_ID = "test-cloud-id-0000"


@dataclass
class FakeJiraClient(JiraClient):
    json_responses: dict[tuple[str, str], dict] = field(default_factory=dict)
    bytes_responses: dict[tuple[str, str], tuple[bytes, str | None]] = field(
        default_factory=dict
    )
    calls: list[tuple[str, str, dict | None]] = field(default_factory=list)
    fail_on_request_json: bool = False
    auth_mode: str = "site"
    cloud_id: str | None = None

    def credentials(self) -> JiraCredentials:
        return JiraCredentials(
            auth_mode=self.auth_mode,
            site_url=JIRA_TEST_BASE,
            api_token="token",
            project_key="FMK",
            cloud_id=self.cloud_id,
            service_account_email="bot@test.com",
        )

    def api_base(self) -> str:
        if self.auth_mode == "service_account":
            cid = self.cloud_id or JIRA_TEST_CLOUD_ID
            return f"{JIRA_PLATFORM_API}/{cid}/rest/api/3"
        return f"{JIRA_TEST_BASE}/rest/api/3"

    def request_json(
        self,
        method: str,
        url: str,
        *,
        data: dict | None = None,
        timeout_seconds: int | None = None,
    ) -> dict:
        self.calls.append((method, url, data))
        if self.fail_on_request_json:
            raise IssueTrackerUnavailableError("jira_unavailable_test")
        key = (method.upper(), url)
        if key in self.json_responses:
            return self.json_responses[key]
        return {"id": "10001", "key": "FMK-1"}

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


def jira_create_issue_client(
    *,
    key: str = "FMK-99",
    ticket_id: str = "10099",
    auth_mode: str = "site",
    cloud_id: str | None = None,
    issue_type_id: str = "10021",
) -> FakeJiraClient:
    fake = FakeJiraClient(auth_mode=auth_mode, cloud_id=cloud_id)
    api = fake.api_base()
    fake.json_responses = {
        ("GET", f"{api}/issue/createmeta?projectKeys=FMK&expand=projects.issuetypes"): {
            "projects": [
                {
                    "key": "FMK",
                    "issuetypes": [
                        {"id": "10019", "name": "Epic", "subtask": False},
                        {"id": issue_type_id, "name": "Задание", "subtask": False},
                    ],
                }
            ],
        },
        ("POST", f"{api}/issue"): {"id": ticket_id, "key": key},
        ("GET", f"{api}/issue/{key}"): {
            "id": ticket_id,
            "key": key,
            "fields": {"status": {"name": "To Do"}, "attachment": []},
        },
        ("GET", f"{api}/issue/{key}?fields=status"): {
            "fields": {"status": {"name": "To Do"}},
        },
        ("GET", f"{api}/issue/{key}?fields=attachment"): {
            "fields": {"attachment": []},
        },
    }
    return fake


def patch_jira_issue_service(
    monkeypatch: pytest.MonkeyPatch,
    client: FakeJiraClient | None = None,
) -> FakeJiraClient:
    fake = client or jira_create_issue_client()
    monkeypatch.setattr(
        "backend.app.integrations.jira.issue_service._default_service",
        JiraIssueService(fake),
    )
    return fake
