"""Конфигурация ISSUE_TRACKER и registry."""

from __future__ import annotations

import pytest

from backend.app.core.config import ServerConfig
from backend.app.integrations.registry import get_issue_tracker, reset_issue_tracker_cache
from backend.app.integrations.noop import NoOpIssueTracker
from backend.app.integrations.yandex.tracker import YandexIssueTracker


class TestResolvedIssueTracker:
    def test_auto_none_without_token(self) -> None:
        cfg = ServerConfig(
            ISSUE_TRACKER="auto",
            TRACKER_TOKEN="",
            JIRA_API_TOKEN="",
            JIRA_PROJECT_KEY="",
            JIRA_CLOUD_ID="",
            JIRA_BASE_URL="",
        )
        assert cfg.resolved_issue_tracker() == "none"
        assert not cfg.external_tracker_enabled()

    def test_auto_jira_when_configured(self) -> None:
        cfg = ServerConfig(
            ISSUE_TRACKER="auto",
            JIRA_BASE_URL="https://x.atlassian.net",
            JIRA_CLOUD_ID="cloud",
            JIRA_API_TOKEN="token",
            JIRA_PROJECT_KEY="FMK",
        )
        assert cfg.resolved_issue_tracker() == "jira"
        assert cfg.external_tracker_enabled()

    def test_auto_yandex_with_token(self) -> None:
        cfg = ServerConfig(
            ISSUE_TRACKER="auto",
            TRACKER_TOKEN="secret",
            JIRA_API_TOKEN="",
            JIRA_PROJECT_KEY="",
            JIRA_CLOUD_ID="",
            JIRA_BASE_URL="",
        )
        assert cfg.resolved_issue_tracker() == "yandex"
        assert cfg.external_tracker_label() == "Yandex Tracker"

    def test_explicit_jira(self) -> None:
        cfg = ServerConfig(ISSUE_TRACKER="jira")
        assert cfg.resolved_issue_tracker() == "jira"
        assert cfg.external_tracker_label() == "Jira"


class TestGetIssueTracker:
    def setup_method(self) -> None:
        reset_issue_tracker_cache()

    def teardown_method(self) -> None:
        reset_issue_tracker_cache()

    def test_none_provider(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("ISSUE_TRACKER", "none")
        from backend.app.core.config import Settings

        fresh = Settings()
        monkeypatch.setattr("backend.app.core.config.settings", fresh)
        monkeypatch.setattr("backend.app.integrations.registry.settings", fresh)
        reset_issue_tracker_cache()
        assert isinstance(get_issue_tracker(), NoOpIssueTracker)

    def test_yandex_provider(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("ISSUE_TRACKER", "yandex")
        monkeypatch.setenv("TRACKER_TOKEN", "t")
        monkeypatch.setenv("TRACKER_ORG_ID", "org")
        monkeypatch.setenv("TRACKER_QUEUE", "Q")
        from backend.app.core.config import Settings

        fresh = Settings()
        monkeypatch.setattr("backend.app.core.config.settings", fresh)
        monkeypatch.setattr("backend.app.integrations.registry.settings", fresh)
        reset_issue_tracker_cache()
        assert isinstance(get_issue_tracker(), YandexIssueTracker)

    def test_jira_provider(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("ISSUE_TRACKER", "jira")
        monkeypatch.setenv("JIRA_BASE_URL", "https://x.atlassian.net")
        monkeypatch.setenv("JIRA_EMAIL", "bot@test.com")
        monkeypatch.setenv("JIRA_API_TOKEN", "token")
        monkeypatch.setenv("JIRA_PROJECT_KEY", "FMK")
        from backend.app.core.config import ServerConfig, Settings
        from backend.app.integrations.jira.client import JiraClient
        from backend.app.integrations.jira.issue_service import JiraIssueService
        from backend.app.integrations.jira.tracker import JiraIssueTracker

        fresh = Settings()
        monkeypatch.setattr("backend.app.core.config.settings", fresh)
        monkeypatch.setattr("backend.app.integrations.registry.settings", fresh)
        reset_issue_tracker_cache()
        tracker = get_issue_tracker()
        assert isinstance(tracker, JiraIssueTracker)

        explicit = JiraIssueTracker(
            JiraIssueService(
                JiraClient(
                    ServerConfig(
                        ISSUE_TRACKER="jira",
                        JIRA_BASE_URL="https://x.atlassian.net",
                        JIRA_EMAIL="bot@test.com",
                        JIRA_API_TOKEN="token",
                        JIRA_PROJECT_KEY="FMK",
                    )
                )
            )
        )
        assert explicit.is_configured()
