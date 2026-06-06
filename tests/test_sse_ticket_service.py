"""SSE-тикеты: opaque token вместо JWT в query string."""

from __future__ import annotations

from uuid import uuid4

import pytest

from backend.app.services.sse_ticket_service import (
    issue_sse_ticket,
    reset_sse_ticket_store_for_tests,
    validate_sse_ticket,
)


@pytest.fixture(autouse=True)
def _reset_ticket_store() -> None:
    reset_sse_ticket_store_for_tests()
    yield
    reset_sse_ticket_store_for_tests()


def test_issue_and_validate_sse_ticket() -> None:
    user_id = uuid4()
    token, expires_in = issue_sse_ticket(user_id)

    assert expires_in >= 30
    assert validate_sse_ticket(token) == user_id


def test_validate_refreshes_ttl_for_reconnect() -> None:
    user_id = uuid4()
    token, _ = issue_sse_ticket(user_id)

    assert validate_sse_ticket(token) == user_id
    assert validate_sse_ticket(token) == user_id


def test_invalid_sse_token_returns_none() -> None:
    assert validate_sse_ticket("") is None
    assert validate_sse_ticket("not-a-real-token") is None
