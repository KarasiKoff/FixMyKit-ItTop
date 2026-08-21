"""Тесты дополнительных полей при создании задачи Jira."""

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace

import pytest

from backend.app.core.config import ServerConfig
from backend.app.integrations.jira.issue_create_fields import build_create_issue_extra_fields
from backend.app.integrations.jira.issue_service import JiraIssueService
from tests.support.fake_jira_client import jira_create_issue_client, patch_jira_issue_service


def _repair_request(**overrides: object) -> SimpleNamespace:
    base = {
        "id": "00000000-0000-0000-0000-000000000001",
        "created_at": datetime(2026, 6, 9, 12, 0, tzinfo=UTC),
        "device_id": None,
        "audience_id": None,
        "author_user_id": None,
        "applicant_name": "Иван",
        "description": "Тест",
        "tracker_ticket_key": None,
        "tracker_ticket_id": None,
        "device": None,
        "audience": None,
        "author": None,
    }
    base.update(overrides)
    return SimpleNamespace(**base)


class TestBuildCreateIssueExtraFields:
    def test_start_date_and_team(self) -> None:
        cfg = ServerConfig(
            JIRA_CREATE_START_DATE_FIELD="customfield_10015",
            JIRA_CREATE_TEAM_FIELD="customfield_10001",
            JIRA_CREATE_TEAM_ID="team-uuid-123",
        )
        extra = build_create_issue_extra_fields(_repair_request(), cfg)
        assert extra == {
            "customfield_10015": "2026-06-09",
            "customfield_10001": "team-uuid-123",
        }

    def test_disabled_start_date(self) -> None:
        cfg = ServerConfig(
            JIRA_CREATE_START_DATE_FIELD="customfield_10015",
            JIRA_CREATE_SET_START_DATE=False,
        )
        assert build_create_issue_extra_fields(_repair_request(), cfg) == {}

    def test_extra_json_merged(self) -> None:
        cfg = ServerConfig(
            JIRA_CREATE_FIELDS_JSON='{"customfield_99999": "x"}',
            JIRA_CREATE_START_DATE_FIELD="customfield_10015",
        )
        extra = build_create_issue_extra_fields(_repair_request(), cfg)
        assert extra["customfield_99999"] == "x"
        assert extra["customfield_10015"] == "2026-06-09"


class TestJiraCreateIssueExtraFields:
    def test_create_issue_includes_configured_fields(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        fake = patch_jira_issue_service(monkeypatch, jira_create_issue_client(key="IS-1"))
        monkeypatch.setattr(
            "backend.app.integrations.jira.issue_service.settings.server",
            ServerConfig(
                JIRA_CREATE_START_DATE_FIELD="customfield_10015",
                JIRA_CREATE_TEAM_FIELD="customfield_10001",
                JIRA_CREATE_TEAM_ID="team-it-support",
                JIRA_BASE_URL="https://jira.test",
                JIRA_EMAIL="a@b.c",
                JIRA_API_TOKEN="t",
                JIRA_PROJECT_KEY="IS",
            ),
        )
        service = JiraIssueService(fake)
        service.sync_repair_request(_repair_request())
        post_calls = [c for c in fake.calls if c[0] == "POST"]
        fields = post_calls[0][2]["fields"]
        assert fields["customfield_10015"] == "2026-06-09"
        assert fields["customfield_10001"] == "team-it-support"
