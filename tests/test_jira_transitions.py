"""Тесты резолва Jira transitions."""

from __future__ import annotations

from backend.app.core.config import ServerConfig
from backend.app.integrations.jira.transitions import (
    find_transition_id_from_issue,
    resolve_transition_id,
    transition_id_for_label,
)
from tests.support.fake_jira_client import FakeJiraClient, JIRA_TEST_BASE


def test_transition_id_from_env() -> None:
    cfg = ServerConfig(JIRA_TRANSITION_IN_PROGRESS="21")
    assert transition_id_for_label("В работе", cfg) == "21"


def test_find_transition_by_name_from_api() -> None:
    fake = FakeJiraClient()
    api = fake.api_base()
    fake.json_responses[("GET", f"{api}/issue/IS-1/transitions")] = {
        "transitions": [
            {"id": "11", "name": "К выполнению", "to": {"name": "К выполнению"}},
            {"id": "21", "name": "В работе", "to": {"name": "В работе"}},
        ],
    }
    assert find_transition_id_from_issue(fake, "IS-1", "В работе") == "21"


def test_resolve_falls_back_to_api_when_env_empty() -> None:
    fake = FakeJiraClient()
    api = fake.api_base()
    fake.json_responses[("GET", f"{api}/issue/IS-2/transitions")] = {
        "transitions": [{"id": "31", "name": "Требуется информация", "to": {"name": "X"}}],
    }
    cfg = ServerConfig(
        JIRA_BASE_URL=JIRA_TEST_BASE,
        JIRA_EMAIL="a@b.c",
        JIRA_API_TOKEN="t",
        JIRA_PROJECT_KEY="FMK",
    )
    assert resolve_transition_id("IS-2", "Требуется информация", client=fake, server=cfg) == "31"
