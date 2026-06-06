"""Обратная совместимость: импорт из tests.support."""

from tests.support.fake_tracker_client import (
    FakeTrackerClient,
    tracker_create_issue_client,
)

__all__ = ["FakeTrackerClient", "tracker_create_issue_client"]
