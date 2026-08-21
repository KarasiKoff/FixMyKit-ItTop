"""HTTP-клиент Jira REST API v3 (сервисный аккаунт Atlassian + legacy site URL)."""

from __future__ import annotations

import base64
import json
import logging
import time
from dataclasses import dataclass
from urllib import error, request

from backend.app.core.config import ServerConfig, settings
from backend.app.integrations.types import IssueTrackerUnavailableError

logger = logging.getLogger("fixmykit.jira")

JIRA_PLATFORM_API = "https://api.atlassian.com/ex/jira"


@dataclass(frozen=True)
class JiraCredentials:
    """Параметры подключения к Jira."""

    auth_mode: str  # service_account | site
    site_url: str
    api_token: str
    project_key: str
    cloud_id: str | None = None
    service_account_email: str | None = None

    @property
    def api_base(self) -> str:
        if self.auth_mode == "service_account":
            cloud_id = (self.cloud_id or "").strip()
            return f"{JIRA_PLATFORM_API}/{cloud_id}/rest/api/3"
        return f"{self.site_url.rstrip('/')}/rest/api/3"

    @property
    def browse_base(self) -> str:
        return self.site_url.rstrip("/")


class JiraClient:
    def __init__(self, server: ServerConfig | None = None) -> None:
        self._server_override = server

    @property
    def _server(self) -> ServerConfig:
        return self._server_override or settings.server

    def api_base(self) -> str:
        return self.credentials().api_base

    def credentials(self) -> JiraCredentials:
        s = self._server
        auth_mode = s.resolved_jira_auth_mode()
        site_url = (s.jira_base_url or "").strip().rstrip("/")
        token = (s.jira_api_token or "").strip()
        project = (s.jira_project_key or "").strip()
        cloud_id = (s.jira_cloud_id or "").strip() or None
        account_email = (
            (s.jira_service_account_email or s.jira_email or "").strip() or None
        )

        if not token:
            raise IssueTrackerUnavailableError("JIRA_API_TOKEN is not set")
        if not project:
            raise IssueTrackerUnavailableError("JIRA_PROJECT_KEY is not set")

        if auth_mode == "service_account":
            if not cloud_id:
                raise IssueTrackerUnavailableError("JIRA_CLOUD_ID is not set")
            if not site_url:
                raise IssueTrackerUnavailableError(
                    "JIRA_BASE_URL is not set (нужен для ссылок browse/KEY)"
                )
            return JiraCredentials(
                auth_mode=auth_mode,
                site_url=site_url,
                api_token=token,
                project_key=project,
                cloud_id=cloud_id,
                service_account_email=account_email,
            )

        if not site_url:
            raise IssueTrackerUnavailableError("JIRA_BASE_URL is not set")
        if not account_email:
            raise IssueTrackerUnavailableError(
                "JIRA_SERVICE_ACCOUNT_EMAIL or JIRA_EMAIL is not set"
            )
        return JiraCredentials(
            auth_mode="site",
            site_url=site_url,
            api_token=token,
            project_key=project,
            service_account_email=account_email,
        )

    def _auth_header(self) -> str:
        creds = self.credentials()
        if creds.auth_mode == "service_account":
            # Scoped API token сервисного аккаунта: Bearer (рекомендуется Atlassian).
            return f"Bearer {creds.api_token}"
        email = creds.service_account_email or ""
        raw = f"{email}:{creds.api_token}".encode("utf-8")
        return "Basic " + base64.b64encode(raw).decode("ascii")

    def _headers(
        self, *, json_body: bool = False, extra: dict[str, str] | None = None
    ) -> dict[str, str]:
        headers = {"Authorization": self._auth_header(), "Accept": "application/json"}
        if json_body:
            headers["Content-Type"] = "application/json"
        if extra:
            headers.update(extra)
        return headers

    def request_json(
        self,
        method: str,
        url: str,
        *,
        data: dict | None = None,
        timeout_seconds: int | None = None,
    ) -> dict:
        payload = json.dumps(data).encode("utf-8") if data is not None else None
        req = request.Request(
            url,
            data=payload,
            method=method,
            headers=self._headers(json_body=data is not None),
        )
        timeout = timeout_seconds or self._server.jira_timeout_seconds
        started = time.perf_counter()
        safe_url = url.split("?", 1)[0]
        try:
            with request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read().decode("utf-8")
                body = json.loads(raw) if raw.strip() else {}
                logger.info(
                    "jira_api_ok",
                    extra={
                        "method": method,
                        "url": safe_url,
                        "auth_mode": self.credentials().auth_mode,
                        "status": getattr(resp, "status", 200),
                        "duration_ms": round((time.perf_counter() - started) * 1000, 2),
                    },
                )
                if not isinstance(body, dict):
                    raise IssueTrackerUnavailableError("jira_expected_object")
                return body
        except error.HTTPError as exc:
            text = exc.read().decode("utf-8", errors="replace")
            logger.error(
                "jira_api_http_error",
                extra={
                    "method": method,
                    "url": safe_url,
                    "status": exc.code,
                    "body_preview": text[:300],
                },
            )
            raise IssueTrackerUnavailableError(f"jira_http_{exc.code}: {text}") from exc
        except error.URLError as exc:
            logger.error(
                "jira_api_network_error",
                extra={"method": method, "url": safe_url, "reason": str(exc.reason)},
            )
            raise IssueTrackerUnavailableError(f"jira_network: {exc.reason}") from exc
        except json.JSONDecodeError as exc:
            raise IssueTrackerUnavailableError("jira_invalid_json") from exc

    def request_bytes(
        self,
        method: str,
        url: str,
        *,
        data: bytes | None = None,
        headers_extra: dict[str, str] | None = None,
        timeout_seconds: int | None = None,
    ) -> tuple[bytes, str | None]:
        req = request.Request(
            url,
            data=data,
            method=method,
            headers=self._headers(extra=headers_extra),
        )
        timeout = timeout_seconds or self._server.jira_timeout_seconds
        safe_url = url.split("?", 1)[0]
        try:
            with request.urlopen(req, timeout=timeout) as resp:
                content_type = resp.headers.get("Content-Type")
                payload = resp.read()
                logger.info(
                    "jira_api_bytes_ok",
                    extra={
                        "method": method,
                        "url": safe_url,
                        "status": getattr(resp, "status", 200),
                        "bytes": len(payload),
                    },
                )
                return payload, content_type
        except error.HTTPError as exc:
            text = exc.read().decode("utf-8", errors="replace")
            raise IssueTrackerUnavailableError(f"jira_http_{exc.code}: {text}") from exc
        except error.URLError as exc:
            raise IssueTrackerUnavailableError(f"jira_network: {exc.reason}") from exc


_default_client: JiraClient | None = None


def get_jira_client() -> JiraClient:
    global _default_client
    if _default_client is None:
        _default_client = JiraClient()
    return _default_client


def set_jira_client(client: JiraClient | None) -> None:
    global _default_client
    _default_client = client


def reset_jira_client() -> None:
    set_jira_client(None)
