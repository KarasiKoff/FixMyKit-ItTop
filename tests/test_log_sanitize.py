"""Маскировка чувствительных параметров в логах."""

from backend.app.core.log_sanitize import (
    sanitize_query_string,
    sanitize_request_uri,
    sanitize_uri_string,
)


def test_sanitize_query_masks_sse_token() -> None:
    assert sanitize_query_string("sse_token=secret123&repair_request_id=abc") == (
        "sse_token=%2A%2A%2A&repair_request_id=abc"
    )


def test_sanitize_query_masks_access_token() -> None:
    assert sanitize_query_string("access_token=jwt.here") == "access_token=%2A%2A%2A"


def test_sanitize_request_uri() -> None:
    assert sanitize_request_uri("/api/events/stream", "sse_token=abc") == (
        "/api/events/stream?sse_token=%2A%2A%2A"
    )


def test_sanitize_uri_string_regex() -> None:
    assert sanitize_uri_string("/api/events/stream?sse_token=abc123") == (
        "/api/events/stream?sse_token=***"
    )
