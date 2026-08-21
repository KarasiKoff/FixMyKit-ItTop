"""JiraIssueService — создание задачи и transitions."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from backend.app.core.config import ServerConfig
from backend.app.integrations.jira.client import JiraClient, JIRA_PLATFORM_API
from backend.app.integrations.jira.issue_service import JiraIssueService
from backend.app.integrations.jira.transitions import transition_id_for_label
from backend.app.integrations.types import IssueTrackerUnavailableError
from tests.support.fake_jira_client import (
    JIRA_TEST_BASE,
    jira_create_issue_client,
    patch_jira_issue_service,
)


def _repair_request(**overrides: object) -> SimpleNamespace:
    base = {
        "id": "00000000-0000-0000-0000-000000000001",
        "device_id": None,
        "audience_id": "00000000-0000-0000-0000-000000000002",
        "author_user_id": None,
        "applicant_name": "Иван",
        "description": "Не работает проектор",
        "tracker_ticket_key": None,
        "tracker_ticket_id": None,
        "device": None,
        "audience": SimpleNamespace(name="101"),
        "author": None,
    }
    base.update(overrides)
    return SimpleNamespace(**base)


class TestJiraClientCredentials:
    def test_service_account_uses_platform_api(self) -> None:
        server = ServerConfig(
            JIRA_BASE_URL="https://org.atlassian.net",
            JIRA_CLOUD_ID="abc-cloud-id",
            JIRA_API_TOKEN="scoped-token",
            JIRA_PROJECT_KEY="FMK",
            JIRA_AUTH_MODE="service_account",
        )
        client = JiraClient(server)
        creds = client.credentials()
        assert creds.auth_mode == "service_account"
        assert creds.api_base == f"{JIRA_PLATFORM_API}/abc-cloud-id/rest/api/3"
        assert creds.browse_base == "https://org.atlassian.net"

    def test_auto_mode_with_cloud_id(self) -> None:
        server = ServerConfig(
            JIRA_BASE_URL="https://org.atlassian.net",
            JIRA_CLOUD_ID="auto-cloud",
            JIRA_API_TOKEN="t",
            JIRA_PROJECT_KEY="FMK",
        )
        assert server.resolved_jira_auth_mode() == "service_account"

    def test_service_account_bearer_auth_header(self) -> None:
        server = ServerConfig(
            JIRA_BASE_URL="https://org.atlassian.net",
            JIRA_CLOUD_ID="abc",
            JIRA_API_TOKEN="my-scoped-token",
            JIRA_PROJECT_KEY="FMK",
        )
        client = JiraClient(server)
        assert client._auth_header() == "Bearer my-scoped-token"

    def test_site_mode_basic_auth_header(self) -> None:
        server = ServerConfig(
            JIRA_BASE_URL="https://org.atlassian.net",
            JIRA_EMAIL="bot@test.com",
            JIRA_API_TOKEN="legacy-token",
            JIRA_PROJECT_KEY="FMK",
            JIRA_AUTH_MODE="site",
        )
        client = JiraClient(server)
        assert client._auth_header().startswith("Basic ")


class TestJiraCreateIssueServiceAccount:
    def test_creates_issue_via_platform_api(self, monkeypatch: pytest.MonkeyPatch) -> None:
        fake = patch_jira_issue_service(
            monkeypatch,
            jira_create_issue_client(
                key="FMK-42",
                auth_mode="service_account",
                cloud_id="cloud-xyz",
            ),
        )
        service = JiraIssueService(fake)
        result = service.sync_repair_request(_repair_request())
        assert result.ticket_key == "FMK-42"
        assert result.ticket_url == "https://jira.test/browse/FMK-42"
        post_calls = [c for c in fake.calls if c[0] == "POST"]
        assert post_calls
        assert post_calls[0][1].startswith(f"{JIRA_PLATFORM_API}/cloud-xyz/rest/api/3/")


class TestTransitionIdForLabel:
    def test_maps_open(self) -> None:
        cfg = ServerConfig(
            JIRA_TRANSITION_OPEN="11",
            JIRA_TRANSITION_IN_PROGRESS="21",
        )
        assert transition_id_for_label("Открыт", cfg) == "11"

    def test_unknown_label(self) -> None:
        cfg = ServerConfig(JIRA_TRANSITION_OPEN="11")
        assert transition_id_for_label("Unknown", cfg) is None


class TestJiraCreateIssue:
    def test_creates_issue(self, monkeypatch: pytest.MonkeyPatch) -> None:
        fake = patch_jira_issue_service(monkeypatch, jira_create_issue_client(key="FMK-42"))
        service = JiraIssueService(fake)
        result = service.sync_repair_request(_repair_request())
        assert result.ticket_key == "FMK-42"
        assert result.ticket_url == "https://jira.test/browse/FMK-42"
        post_calls = [c for c in fake.calls if c[0] == "POST"]
        assert post_calls
        assert post_calls[0][2]["fields"]["project"]["key"] == "FMK"
        assert post_calls[0][2]["fields"]["labels"] == ["fmk"]
        desc = post_calls[0][2]["fields"]["description"]
        assert desc["type"] == "doc"
        assert any(
            node.get("type") == "heading" and node["content"][0]["text"] == "Кабинет"
            for node in desc.get("content", [])
        )

    def test_fetches_existing(self, monkeypatch: pytest.MonkeyPatch) -> None:
        fake = patch_jira_issue_service(monkeypatch)
        service = JiraIssueService(fake)
        rr = _repair_request(tracker_ticket_key="FMK-1")
        result = service.sync_repair_request(rr)
        assert result.ticket_key == "FMK-1"


class TestJiraPushStatus:
    def test_executes_transition(self, monkeypatch: pytest.MonkeyPatch) -> None:
        fake = jira_create_issue_client(key="FMK-7")
        api = fake.api_base()
        fake.json_responses[("GET", f"{api}/issue/FMK-7/transitions")] = {
            "transitions": [{"id": "21", "name": "В работе", "to": {"name": "В работе"}}],
        }
        fake.json_responses[("GET", f"{api}/issue/FMK-7?fields=status")] = {
            "fields": {"status": {"name": "К выполнению"}},
        }
        patch_jira_issue_service(monkeypatch, fake)
        monkeypatch.setattr(
            "backend.app.integrations.jira.issue_service.settings.server",
            ServerConfig(
                JIRA_TRANSITION_IN_PROGRESS="31",
                JIRA_BASE_URL=JIRA_TEST_BASE,
                JIRA_EMAIL="a@b.c",
                JIRA_API_TOKEN="t",
                JIRA_PROJECT_KEY="FMK",
            ),
        )
        service = JiraIssueService(fake)
        rr = _repair_request(tracker_ticket_key="FMK-7")
        service.push_status(rr, "В работе")
        transition_calls = [
            c
            for c in fake.calls
            if c[0] == "POST" and c[1].endswith("/transitions")
        ]
        assert len(transition_calls) == 1
        assert transition_calls[0][2]["transition"]["id"] == "31"

    def test_close_transition_without_resolution_field(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        fake = jira_create_issue_client(key="FMK-8")
        api = fake.api_base()
        fake.json_responses[("GET", f"{api}/issue/FMK-8/transitions")] = {
            "transitions": [{"id": "41", "name": "Решено", "to": {"name": "Решено"}}],
        }
        fake.json_responses[("GET", f"{api}/issue/FMK-8?fields=status")] = {
            "fields": {"status": {"name": "В работе"}},
        }
        fake.json_responses[("POST", f"{api}/issue/FMK-8/transitions")] = {}
        patch_jira_issue_service(monkeypatch, fake)
        monkeypatch.setattr(
            "backend.app.integrations.jira.issue_service.settings.server",
            ServerConfig(
                JIRA_TRANSITION_CLOSED="41",
                JIRA_BASE_URL=JIRA_TEST_BASE,
                JIRA_EMAIL="a@b.c",
                JIRA_API_TOKEN="t",
                JIRA_PROJECT_KEY="FMK",
            ),
        )
        service = JiraIssueService(fake)
        rr = _repair_request(tracker_ticket_key="FMK-8")
        service.push_status(rr, "Закрыт", resolution="fixed")
        post_calls = [c for c in fake.calls if c[0] == "POST" and c[1].endswith("/transitions")]
        assert len(post_calls) == 1
        assert post_calls[0][2] == {"transition": {"id": "41"}}

    def test_missing_transition_config_raises(self, monkeypatch: pytest.MonkeyPatch) -> None:
        fake = patch_jira_issue_service(monkeypatch)
        monkeypatch.setattr(
            "backend.app.integrations.jira.issue_service.settings.server",
            ServerConfig(
                JIRA_BASE_URL=JIRA_TEST_BASE,
                JIRA_EMAIL="a@b.c",
                JIRA_API_TOKEN="t",
                JIRA_PROJECT_KEY="FMK",
                JIRA_TRANSITION_OPEN="",
                JIRA_TRANSITION_IN_PROGRESS="",
                JIRA_TRANSITION_NEEDS_INFO="",
                JIRA_TRANSITION_CLOSED="",
            ),
        )
        service = JiraIssueService(fake)
        rr = _repair_request(tracker_ticket_key="FMK-1")
        with pytest.raises(IssueTrackerUnavailableError, match="jira_transition_not_configured"):
            service.push_status(rr, "В работе")
