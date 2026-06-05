"""Правила переходов статуса: API vs вебхук Tracker."""

from backend.app.models.enums import RequestStatus
from backend.app.services.repair_request_transitions import (
    TransitionSource,
    can_transition,
)


class TestApiTransitions:
    def test_needs_info_to_in_progress(self) -> None:
        assert can_transition(
            RequestStatus.NEEDS_INFO,
            RequestStatus.IN_PROGRESS,
            TransitionSource.API,
        )

    def test_closed_cannot_reopen_via_api(self) -> None:
        assert not can_transition(
            RequestStatus.CLOSED,
            RequestStatus.OPEN,
            TransitionSource.API,
        )


class TestWebhookTransitions:
    def test_closed_can_reopen_via_webhook(self) -> None:
        assert can_transition(
            RequestStatus.CLOSED,
            RequestStatus.OPEN,
            TransitionSource.WEBHOOK,
        )

    def test_in_progress_can_go_open_via_webhook(self) -> None:
        assert can_transition(
            RequestStatus.IN_PROGRESS,
            RequestStatus.OPEN,
            TransitionSource.WEBHOOK,
        )
