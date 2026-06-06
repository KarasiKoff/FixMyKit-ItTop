"""Абстракция HTTP-клиента Tracker для DI и тестов."""

from __future__ import annotations

from typing import Protocol

from backend.app.clients.tracker_client import TrackerCredentials


class TrackerHttpClient(Protocol):
    """Минимальный контракт для tracker_issue_service (реализация — TrackerClient / FakeTrackerClient)."""

    def credentials(self) -> TrackerCredentials: ...

    def request_json(
        self, method: str, url: str, *, data: dict | None = None
    ) -> dict: ...

    def request_json_list(self, method: str, url: str) -> list: ...

    def request_bytes(
        self,
        method: str,
        url: str,
        *,
        data: bytes | None = None,
        headers_extra: dict[str, str] | None = None,
        timeout_seconds: int | None = None,
    ) -> tuple[bytes, str | None]: ...
