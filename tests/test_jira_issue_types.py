"""Резолв JIRA_ISSUE_TYPE через createmeta."""

from __future__ import annotations

from backend.app.core.config import ServerConfig
from backend.app.integrations.jira.client import JiraClient
from backend.app.integrations.jira.issue_types import (
    _pick_default_issue_type,
    resolve_issue_type_field,
)
from tests.support.fake_jira_client import jira_create_issue_client


class TestPickDefaultIssueType:
    def test_skips_subtask_and_epic(self) -> None:
        picked = _pick_default_issue_type(
            [
                {"id": "1", "name": "Epic", "subtask": False},
                {"id": "2", "name": "Sub-task", "subtask": True},
                {"id": "3", "name": "Задание", "subtask": False},
            ]
        )
        assert picked is not None
        assert picked["id"] == "3"


class TestResolveIssueTypeField:
    def test_uses_explicit_id(self) -> None:
        server = ServerConfig(
            JIRA_ISSUE_TYPE_ID="10021",
            JIRA_PROJECT_KEY="IS",
            JIRA_API_TOKEN="t",
            JIRA_BASE_URL="https://x.atlassian.net",
            JIRA_CLOUD_ID="cloud",
        )
        assert resolve_issue_type_field(JiraClient(server), server) == {"id": "10021"}

    def test_resolves_from_createmeta_when_name_invalid(self) -> None:
        fake = jira_create_issue_client(auth_mode="service_account", cloud_id="cloud-x")
        api = fake.api_base()
        fake.json_responses[("GET", f"{api}/issue/createmeta?projectKeys=FMK&expand=projects.issuetypes")] = {
            "projects": [
                {
                    "key": "FMK",
                    "issuetypes": [
                        {"id": "10019", "name": "Epic", "subtask": False},
                        {"id": "10021", "name": "Задание", "subtask": False},
                    ],
                }
            ],
        }
        server = ServerConfig(
            JIRA_ISSUE_TYPE="Task",
            JIRA_PROJECT_KEY="FMK",
            JIRA_API_TOKEN="t",
            JIRA_BASE_URL="https://x.atlassian.net",
            JIRA_CLOUD_ID="cloud-x",
        )
        assert resolve_issue_type_field(fake, server) == {"id": "10021"}