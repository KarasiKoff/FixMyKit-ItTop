"""SSE: выдача тикета и доступ к stream без JWT в query."""

from __future__ import annotations

from collections.abc import AsyncIterator


async def _finite_sse_stream(*, repair_request_id: str | None) -> AsyncIterator[str]:
    """Подмена для TestClient: один ping вместо бесконечного цикла."""
    from backend.app.services.realtime_hub import format_sse_ping

    yield format_sse_ping()


def test_issue_sse_ticket_requires_auth(client) -> None:
    response = client.post("/api/events/ticket")
    assert response.status_code == 401


def test_issue_sse_ticket_and_open_stream(client, admin_headers, monkeypatch) -> None:
    monkeypatch.setattr(
        "backend.app.api.routes.events._sse_stream",
        _finite_sse_stream,
    )

    ticket_resp = client.post("/api/events/ticket", headers=admin_headers)
    assert ticket_resp.status_code == 200
    body = ticket_resp.json()
    assert body["sse_token"]
    assert body["expires_in"] >= 30

    stream_resp = client.get(
        "/api/events/stream",
        params={"sse_token": body["sse_token"]},
        headers={"Accept": "text/event-stream"},
    )
    assert stream_resp.status_code == 200
    assert "text/event-stream" in stream_resp.headers.get("content-type", "")
    assert stream_resp.text


def test_stream_rejects_jwt_in_query(client, admin_headers) -> None:
    stream_resp = client.get(
        "/api/events/stream",
        params={"access_token": "fake-jwt"},
        headers={"Accept": "text/event-stream"},
    )
    assert stream_resp.status_code == 422
