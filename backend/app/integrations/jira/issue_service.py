"""Доменная логика Jira: задачи, transitions, комментарии, вложения."""

from __future__ import annotations

import json
import mimetypes
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import quote
from uuid import uuid4

from backend.app.core.config import settings
from backend.app.integrations.jira.adf import plain_text_adf
from backend.app.integrations.jira.issue_description import (
    build_issue_summary,
    build_repair_request_description_adf,
    default_issue_labels,
)
from backend.app.integrations.jira.client import JiraClient, JiraCredentials, get_jira_client
from backend.app.integrations.jira.issue_types import resolve_issue_type_field
from backend.app.integrations.jira.transitions import (
    find_transition_id_from_issue,
    resolve_transition_id,
    transition_id_for_label,
)
from backend.app.integrations.types import (
    ExternalAttachmentMeta,
    ExternalIssueResult,
    IssueTrackerUnavailableError,
)
from backend.app.models.repair_request import RepairRequest
from backend.app.models.user import User
from backend.app.services.tracker_types import issue_ref_for


class JiraIssueService:
    def __init__(self, client: JiraClient | None = None) -> None:
        self._client = client or get_jira_client()

    def is_configured(self) -> bool:
        try:
            self._client.credentials()
            return True
        except IssueTrackerUnavailableError:
            return False

    def sync_repair_request(self, repair_request: RepairRequest) -> ExternalIssueResult:
        issue_ref = issue_ref_for(repair_request)
        if issue_ref:
            return self._fetch_issue(issue_ref)
        return self._create_issue(repair_request)

    def push_status(
        self,
        repair_request: RepairRequest,
        label: str,
        *,
        resolution: str | None = None,
    ) -> None:
        ref = self._require_ref(repair_request)
        transition_id = resolve_transition_id(ref, label, client=self._client)
        if not transition_id:
            raise IssueTrackerUnavailableError(f"jira_transition_not_configured:{label}")

        issue = self._get_issue_fields(ref, fields="status")
        current = _issue_status_name(issue)
        if current and (_labels_match(current, label) or _jira_status_matches_fmk_label(current, label)):
            return

        body: dict = {"transition": {"id": transition_id}}
        # Резолюция при закрытии — в комментарии (sync_resolution_comment_to_tracker),
        # не в fields transition: в ITSM Jira часто нельзя передать resolution в POST.

        url = f"{self._client.api_base()}/issue/{quote(ref, safe='')}/transitions"
        try:
            self._client.request_json("POST", url, data=body)
        except IssueTrackerUnavailableError as exc:
            msg = exc.message or ""
            if "not valid for this issue" in msg:
                fallback_id = find_transition_id_from_issue(self._client, ref, label)
                if fallback_id and fallback_id != transition_id:
                    body["transition"] = {"id": fallback_id}
                    self._client.request_json("POST", url, data=body)
                    return
            raise

    def add_comment(
        self,
        repair_request: RepairRequest,
        body: str,
        *,
        markup_md: bool = True,
    ) -> None:
        ref = self._require_ref(repair_request)
        text = (body or "").strip()
        if not text:
            raise IssueTrackerUnavailableError("jira_comment_text_empty")
        url = f"{self._client.api_base()}/issue/{quote(ref, safe='')}/comment"
        payload = {"body": plain_text_adf(text)}
        self._client.request_json("POST", url, data=payload)

    def add_site_user_comment(
        self, repair_request: RepairRequest, user: User, body: str
    ) -> None:
        display = (user.full_name or "").strip() or user.login
        text = f"{display} (Fix My Kit):\n\n{(body or '').strip()}"
        self.add_comment(repair_request, text)

    def push_publish_comment(
        self, repair_request: RepairRequest, *, is_published: bool
    ) -> None:
        text = (
            "[Fix My Kit] Заявка опубликована для гостей (видна по QR)."
            if is_published
            else "[Fix My Kit] Публикация заявки снята — для гостей не отображается."
        )
        self.add_comment(repair_request, text)

    def push_sysadmin_taken_comment(
        self, repair_request: RepairRequest, *, taken: bool
    ) -> None:
        text = (
            "[Fix My Kit] Устройство забрал системный администратор."
            if taken
            else "[Fix My Kit] Снята пометка «забрал сисадмин» — устройство на месте."
        )
        self.add_comment(repair_request, text)

    def upload_attachment(
        self,
        repair_request: RepairRequest,
        *,
        file_path: Path,
        filename: str,
    ) -> ExternalAttachmentMeta:
        ref = self._require_ref(repair_request)
        creds = self._client.credentials()
        safe_ref = quote(ref, safe="")
        url = f"{self._client.api_base()}/issue/{safe_ref}/attachments"
        payload, boundary = _build_multipart(file_path, filename)
        file_size = file_path.stat().st_size
        timeout = max(
            settings.server.jira_attachment_timeout_seconds,
            60 + file_size // (1024 * 1024),
        )
        raw, _ = self._client.request_bytes(
            "POST",
            url,
            data=payload,
            headers_extra={
                "Content-Type": f"multipart/form-data; boundary={boundary}",
                "X-Atlassian-Token": "no-check",
            },
            timeout_seconds=timeout,
        )
        try:
            body = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise IssueTrackerUnavailableError("jira_invalid_json") from exc
        if not isinstance(body, list) or not body:
            raise IssueTrackerUnavailableError("jira_attachment_response_invalid")
        row = body[0]
        if not isinstance(row, dict):
            raise IssueTrackerUnavailableError("jira_attachment_response_invalid")
        return _parse_attachment(row, creds.browse_base)

    def list_attachments(
        self, repair_request: RepairRequest
    ) -> list[ExternalAttachmentMeta]:
        ref = issue_ref_for(repair_request)
        if not ref:
            return []
        creds = self._client.credentials()
        issue = self._get_issue_fields(ref, fields="attachment")
        attachments = issue.get("fields", {}).get("attachment")
        if not isinstance(attachments, list):
            return []
        return [
            _parse_attachment(row, creds.browse_base)
            for row in attachments
            if isinstance(row, dict) and row.get("id")
        ]

    def fetch_attachment_content(
        self,
        repair_request: RepairRequest,
        attachment_id: str,
        *,
        variant: str = "content",
    ) -> tuple[bytes, str | None]:
        ref = issue_ref_for(repair_request)
        if not ref:
            raise IssueTrackerUnavailableError("jira_issue_ref_missing")
        match = next(
            (item for item in self.list_attachments(repair_request) if item.id == attachment_id),
            None,
        )
        if match is None:
            raise IssueTrackerUnavailableError("jira_attachment_not_found")
        url = match.thumbnail_url if variant == "thumbnail" else match.content_url
        if not url:
            raise IssueTrackerUnavailableError("jira_attachment_url_missing")
        return self._client.request_bytes("GET", url)

    def status_comment_from_site(self, label: str) -> str:
        clean = (label or "").strip() or "—"
        return f"[Fix My Kit] Статус изменён: {clean}"

    def _require_ref(self, repair_request: RepairRequest) -> str:
        ref = issue_ref_for(repair_request)
        if not ref:
            raise IssueTrackerUnavailableError("jira_issue_ref_missing")
        return ref

    def _fetch_issue(self, issue_ref: str) -> ExternalIssueResult:
        creds = self._client.credentials()
        url = f"{self._client.api_base()}/issue/{quote(issue_ref, safe='')}"
        body = self._client.request_json("GET", url)
        return _parse_issue_response(body, creds.browse_base)

    def _create_issue(self, repair_request: RepairRequest) -> ExternalIssueResult:
        creds = self._client.credentials()
        summary = build_issue_summary(repair_request)
        issue_type = resolve_issue_type_field(self._client)
        fields: dict = {
            "project": {"key": creds.project_key},
            "issuetype": issue_type,
            "summary": summary[:255],
            "description": build_repair_request_description_adf(repair_request),
        }
        labels = default_issue_labels()
        if labels:
            fields["labels"] = labels
        payload = {"fields": fields}
        url = f"{self._client.api_base()}/issue"
        body = self._client.request_json("POST", url, data=payload)
        return _parse_issue_response(body, creds.browse_base)

    def _get_issue_fields(self, issue_ref: str, *, fields: str) -> dict:
        url = (
            f"{self._client.api_base()}/issue/{quote(issue_ref, safe='')}"
            f"?fields={quote(fields, safe='')}"
        )
        return self._client.request_json("GET", url)


_default_service: JiraIssueService | None = None


def get_jira_issue_service() -> JiraIssueService:
    global _default_service
    if _default_service is None:
        _default_service = JiraIssueService()
    return _default_service


def set_jira_issue_service(service: JiraIssueService | None) -> None:
    global _default_service
    _default_service = service


def reset_jira_issue_service() -> None:
    set_jira_issue_service(None)


def _parse_issue_response(body: dict, base_url: str) -> ExternalIssueResult:
    ticket_id = str(body.get("id") or "")
    ticket_key = str(body.get("key") or "")
    if not ticket_id or not ticket_key:
        raise IssueTrackerUnavailableError("jira_response_missing_fields")
    ticket_url = f"{base_url.rstrip('/')}/browse/{ticket_key}"
    return ExternalIssueResult(
        ticket_id=ticket_id,
        ticket_key=ticket_key,
        ticket_url=ticket_url,
        synced_at=datetime.now(UTC),
    )


def _parse_attachment(row: dict, base_url: str) -> ExternalAttachmentMeta:
    content = row.get("content")
    content_url = str(content) if content else None
    if content_url and content_url.startswith("/"):
        content_url = f"{base_url.rstrip('/')}{content_url}"
    thumb = row.get("thumbnail")
    thumb_url = str(thumb) if thumb else None
    if thumb_url and thumb_url.startswith("/"):
        thumb_url = f"{base_url.rstrip('/')}{thumb_url}"
    return ExternalAttachmentMeta(
        id=str(row.get("id") or ""),
        name=str(row.get("filename") or row.get("name") or "file"),
        mimetype=(str(row["mimeType"]) if row.get("mimeType") else None),
        size=int(row["size"]) if row.get("size") is not None else None,
        thumbnail_url=thumb_url,
        content_url=content_url,
        created_at=str(row.get("created") or row.get("createdAt") or "") or None,
    )


def _issue_status_name(issue_body: dict) -> str | None:
    status = issue_body.get("fields", {}).get("status")
    if isinstance(status, dict):
        name = status.get("name")
        if isinstance(name, str) and name.strip():
            return name.strip()
    return None


def _labels_match(current: str, target: str) -> bool:
    return current.strip().casefold() == target.strip().casefold()


def _jira_status_matches_fmk_label(jira_status: str, fmk_label: str) -> bool:
    """Сопоставление статуса Jira («К выполнению») с подписью FMK («Открыт»)."""
    from backend.app.integrations.jira.transitions import FMK_LABEL_TO_JIRA_TRANSITION_NAMES

    names = FMK_LABEL_TO_JIRA_TRANSITION_NAMES.get(fmk_label.strip(), ())
    fold = jira_status.strip().casefold()
    return fold in {n.casefold() for n in names} or _labels_match(jira_status, fmk_label)


def _jira_resolution_name(resolution_key: str) -> str:
    mapping = {
        "fixed": "Done",
        "wontFix": "Won't Do",
        "wontfix": "Won't Do",
    }
    return mapping.get(resolution_key.strip(), "Done")


def _build_multipart(file_path: Path, filename: str) -> tuple[bytes, str]:
    body_bytes = file_path.read_bytes()
    mime = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    boundary = f"----FixMyKitJira{uuid4().hex}"
    safe_name = filename.replace('"', "'")
    payload = b"".join(
        [
            f"--{boundary}\r\n".encode(),
            f'Content-Disposition: form-data; name="file"; filename="{safe_name}"\r\n'.encode(),
            f"Content-Type: {mime}\r\n\r\n".encode(),
            body_bytes,
            f"\r\n--{boundary}--\r\n".encode(),
        ]
    )
    return payload, boundary

