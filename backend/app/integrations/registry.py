"""Выбор провайдера внешнего трекера по ISSUE_TRACKER."""

from __future__ import annotations

from backend.app.core.config import settings
from backend.app.integrations.noop import NoOpIssueTracker
from backend.app.integrations.types import IssueTracker

_override: IssueTracker | None = None
_cached: IssueTracker | None = None
_cached_for: str | None = None


def get_issue_tracker() -> IssueTracker:
    global _cached, _cached_for
    if _override is not None:
        return _override

    provider = settings.server.resolved_issue_tracker()
    if _cached is not None and _cached_for == provider:
        return _cached

    match provider:
        case "yandex":
            from backend.app.integrations.yandex.tracker import YandexIssueTracker

            tracker: IssueTracker = YandexIssueTracker()
        case "jira":
            from backend.app.integrations.jira.tracker import JiraIssueTracker

            tracker = JiraIssueTracker()
        case _:
            tracker = NoOpIssueTracker()

    _cached = tracker
    _cached_for = provider
    return tracker


def reset_issue_tracker_cache() -> None:
    global _cached, _cached_for, _override
    _cached = None
    _cached_for = None
    _override = None
    from backend.app.integrations.jira.client import reset_jira_client
    from backend.app.integrations.jira.issue_types import reset_issue_type_cache
    from backend.app.integrations.jira.issue_service import reset_jira_issue_service
    from backend.app.services.tracker_issue_service import reset_tracker_issue_service

    reset_jira_client()
    reset_jira_issue_service()
    reset_issue_type_cache()
    reset_tracker_issue_service()


def set_issue_tracker_for_tests(tracker: IssueTracker | None) -> None:
    """Подмена провайдера в тестах."""
    global _override, _cached, _cached_for
    _override = tracker
    _cached = None
    _cached_for = None


def external_tracker_enabled() -> bool:
    return settings.server.external_tracker_enabled()


def external_tracker_label() -> str:
    return settings.server.external_tracker_label()
