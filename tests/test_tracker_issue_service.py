"""Синхронизация статусов с Yandex Tracker."""

from backend.app.services.tracker_issue_service import TrackerIssueService


class TestLabelsMatch:
    def test_same_label(self) -> None:
        assert TrackerIssueService._labels_match("В работе", "В работе")

    def test_case_insensitive(self) -> None:
        assert TrackerIssueService._labels_match("в работе", "В Работе")

    def test_needs_info_is_not_in_progress(self) -> None:
        """Регрессия: «Требуется информация» не должно считаться «В работе» при push в Tracker."""
        assert not TrackerIssueService._labels_match("Требуется информация", "В работе")

    def test_in_progress_is_not_needs_info(self) -> None:
        assert not TrackerIssueService._labels_match("В работе", "Требуется информация")
