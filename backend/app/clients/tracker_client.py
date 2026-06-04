"""HTTP-клиент Yandex Tracker API."""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from urllib import error, request

from backend.app.core.config import ServerConfig, settings

logger = logging.getLogger("fixmykit.tracker")


class TrackerUnavailableError(Exception):
    """Ошибка сети, HTTP или неожиданный ответ Tracker."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


@dataclass(frozen=True)
class TrackerCredentials:
    base_url: str
    token: str
    org_id: str
    queue: str


class TrackerClient:
    """Низкоуровневые запросы к Tracker; доменная логика — в tracker_issue_service."""

    def __init__(self, server: ServerConfig | None = None) -> None:
        self._server = server or settings.server

    def credentials(self) -> TrackerCredentials:
        s = self._server
        if not s.tracker_token:
            raise TrackerUnavailableError("TRACKER_TOKEN is not set")
        if not s.tracker_org_id:
            raise TrackerUnavailableError("TRACKER_ORG_ID is not set")
        if not s.tracker_queue:
            raise TrackerUnavailableError("TRACKER_QUEUE is not set")
        return TrackerCredentials(
            base_url=s.tracker_base_url.rstrip("/"),
            token=s.tracker_token,
            org_id=s.tracker_org_id,
            queue=s.tracker_queue,
        )

    @staticmethod
    def _headers(token: str, org_id: str, *, json_body: bool = False) -> dict[str, str]:
        headers: dict[str, str] = {
            "Authorization": f"OAuth {token}",
            "X-Cloud-Org-ID": org_id,
        }
        if json_body:
            headers["Content-Type"] = "application/json"
        return headers

    def request_json(
        self,
        method: str,
        url: str,
        *,
        data: dict | None = None,
    ) -> dict:
        creds = self.credentials()
        payload = json.dumps(data).encode("utf-8") if data is not None else None
        req = request.Request(
            url,
            data=payload,
            method=method,
            headers=self._headers(creds.token, creds.org_id, json_body=data is not None),
        )
        timeout = self._server.tracker_timeout_seconds
        started = time.perf_counter()
        safe_url = url.split("?", 1)[0]
        try:
            with request.urlopen(req, timeout=timeout) as resp:
                body = json.loads(resp.read().decode("utf-8"))
                logger.info(
                    "tracker_api_ok",
                    extra={
                        "method": method,
                        "url": safe_url,
                        "status": getattr(resp, "status", 200),
                        "duration_ms": round((time.perf_counter() - started) * 1000, 2),
                    },
                )
                return body
        except error.HTTPError as exc:
            text = exc.read().decode("utf-8", errors="replace")
            logger.error(
                "tracker_api_http_error",
                extra={
                    "method": method,
                    "url": safe_url,
                    "status": exc.code,
                    "duration_ms": round((time.perf_counter() - started) * 1000, 2),
                    "body_preview": text[:300],
                },
            )
            raise TrackerUnavailableError(f"tracker_http_{exc.code}: {text}") from exc
        except error.URLError as exc:
            logger.error(
                "tracker_api_network_error",
                extra={
                    "method": method,
                    "url": safe_url,
                    "reason": str(exc.reason),
                    "duration_ms": round((time.perf_counter() - started) * 1000, 2),
                },
            )
            raise TrackerUnavailableError(f"tracker_network: {exc.reason}") from exc
        except json.JSONDecodeError as exc:
            logger.error(
                "tracker_api_invalid_json",
                extra={"method": method, "url": safe_url},
            )
            raise TrackerUnavailableError("tracker_invalid_json") from exc

    def request_bytes(
        self,
        method: str,
        url: str,
        *,
        data: bytes | None = None,
        headers_extra: dict[str, str] | None = None,
        timeout_seconds: int | None = None,
    ) -> tuple[bytes, str | None]:
        creds = self.credentials()
        headers = self._headers(creds.token, creds.org_id, json_body=False)
        if headers_extra:
            headers.update(headers_extra)
        req = request.Request(url, data=data, method=method, headers=headers)
        timeout = (
            timeout_seconds
            if timeout_seconds is not None
            else self._server.tracker_timeout_seconds
        )
        started = time.perf_counter()
        safe_url = url.split("?", 1)[0]
        try:
            with request.urlopen(req, timeout=timeout) as resp:
                content_type = resp.headers.get("Content-Type")
                payload = resp.read()
                logger.info(
                    "tracker_api_bytes_ok",
                    extra={
                        "method": method,
                        "url": safe_url,
                        "status": getattr(resp, "status", 200),
                        "bytes": len(payload),
                        "duration_ms": round((time.perf_counter() - started) * 1000, 2),
                    },
                )
                return payload, content_type
        except error.HTTPError as exc:
            text = exc.read().decode("utf-8", errors="replace")
            logger.error(
                "tracker_api_bytes_http_error",
                extra={
                    "method": method,
                    "url": safe_url,
                    "status": exc.code,
                    "body_preview": text[:300],
                },
            )
            raise TrackerUnavailableError(f"tracker_http_{exc.code}: {text}") from exc
        except error.URLError as exc:
            logger.error(
                "tracker_api_bytes_network_error",
                extra={"method": method, "url": safe_url, "reason": str(exc.reason)},
            )
            raise TrackerUnavailableError(f"tracker_network: {exc.reason}") from exc

    def request_json_list(self, method: str, url: str) -> list:
        raw, _ = self.request_bytes(method, url)
        try:
            body = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise TrackerUnavailableError("tracker_invalid_json") from exc
        if not isinstance(body, list):
            raise TrackerUnavailableError("tracker_expected_list")
        return body


_default_client: TrackerClient | None = None


def get_tracker_client() -> TrackerClient:
    global _default_client
    if _default_client is None:
        _default_client = TrackerClient()
    return _default_client
