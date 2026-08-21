"""Маппинг JIRA_STATUS_MAP → RequestStatus."""

from __future__ import annotations

import pytest

from backend.app.core.config import ServerConfig
from backend.app.integrations.jira.status_map import (
    map_jira_status_to_request,
    parse_jira_status_map,
)
from backend.app.models.enums import RequestStatus


class TestParseJiraStatusMap:
    def test_parses_valid_json(self) -> None:
        raw = '{"To Do":"open","In Progress":"in_progress","Done":"closed"}'
        m = parse_jira_status_map(raw)
        assert m["To Do"] == RequestStatus.OPEN
        assert m["In Progress"] == RequestStatus.IN_PROGRESS
        assert m["Done"] == RequestStatus.CLOSED

    def test_invalid_json_returns_empty(self) -> None:
        assert parse_jira_status_map("{bad") == {}

    def test_unknown_value_skipped(self) -> None:
        m = parse_jira_status_map('{"Custom":"unknown"}')
        assert m == {}


class TestMapJiraStatusToRequest:
    def test_uses_server_config(self) -> None:
        cfg = ServerConfig(
            JIRA_STATUS_MAP='{"Waiting for customer":"needs_info"}',
        )
        assert (
            map_jira_status_to_request("Waiting for customer", cfg)
            == RequestStatus.NEEDS_INFO
        )

    def test_empty_env_uses_builtin_default(self) -> None:
        cfg = ServerConfig(JIRA_STATUS_MAP="{}")
        assert map_jira_status_to_request("К выполнению", cfg) == RequestStatus.OPEN
        assert map_jira_status_to_request("Решено", cfg) == RequestStatus.CLOSED
        assert map_jira_status_to_request("To Do", cfg) == RequestStatus.OPEN

    @pytest.mark.parametrize("raw", ["", "   ", "Unknown"])
    def test_unknown_returns_none(self, raw: str) -> None:
        cfg = ServerConfig(JIRA_STATUS_MAP='{"To Do":"open"}')
        assert map_jira_status_to_request(raw, cfg) is None
