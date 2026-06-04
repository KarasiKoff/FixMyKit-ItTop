"""Доменная работа с задачами Yandex Tracker (создание, статусы, вложения, комментарии)."""

from __future__ import annotations

import json
import mimetypes
from pathlib import Path
from urllib.parse import quote
from urllib.parse import quote as urlquote
from uuid import uuid4

from backend.app.clients.tracker_client import TrackerClient, TrackerCredentials, TrackerUnavailableError, get_tracker_client
from backend.app.core.config import settings
from backend.app.models.repair_request import RepairRequest
from backend.app.models.user import User
from backend.app.services.tracker_types import (
    TrackerAttachmentMeta,
    TrackerIssueResult,
    issue_ref_for,
    parse_attachment,
    parse_issue_response,
)


def yfm_red(text: str) -> str:
    """Красный текст в комментарии Tracker (YFM, markupType=md)."""
    return f"{{red}}({text})"


def tracker_comment_status_sync(tracker_status_label: str) -> str:
    label = (tracker_status_label or "").strip() or "—"
    return yfm_red(f"В Fix My Kit синхронизирован статус заявки: **{label}**")


def tracker_comment_status_from_site(target_status_label: str) -> str:
    label = (target_status_label or "").strip() or "—"
    return yfm_red(f"Статус изменён в Fix My Kit: **{label}**")


SYSADMIN_TAKEN_TRACKER_COMMENT = yfm_red(
    "В Fix My Kit добавлена пометка: устройство **забрал системный администратор**."
)
SYSADMIN_RETURNED_TRACKER_COMMENT = yfm_red(
    "В Fix My Kit снята пометка «забрал сисадмин» — устройство на месте."
)
PUBLISH_TRACKER_COMMENT = yfm_red(
    "В Fix My Kit заявка **опубликована** для гостей (видна по QR на устройстве)."
)
UNPUBLISH_TRACKER_COMMENT = yfm_red(
    "В Fix My Kit публикация заявки **снята** — для гостей не отображается."
)


class TrackerIssueService:
    def __init__(self, client: TrackerClient | None = None) -> None:
        self._client = client or get_tracker_client()

    def credentials(self) -> TrackerCredentials:
        return self._client.credentials()

    def sync_repair_request(self, repair_request: RepairRequest) -> TrackerIssueResult:
        """Создаёт задачу в Tracker или подтверждает существующую по ключу/id в БД."""
        creds = self.credentials()
        issue_ref = repair_request.tracker_ticket_key or repair_request.tracker_ticket_id
        if issue_ref:
            return self._fetch_issue(creds, issue_ref)
        return self._create_issue(repair_request, creds)

    def list_attachments(self, repair_request: RepairRequest) -> list[TrackerAttachmentMeta]:
        ref = issue_ref_for(repair_request)
        if not ref:
            return []
        creds = self.credentials()
        url = f"{creds.base_url}/issues/{quote(ref, safe='')}/attachments"
        items = self._client.request_json_list("GET", url)
        return [parse_attachment(row) for row in items if isinstance(row, dict) and row.get("id")]

    def upload_attachment(
        self,
        issue_ref: str,
        *,
        file_path: Path,
        filename: str,
    ) -> TrackerAttachmentMeta:
        creds = self.credentials()
        safe_ref = quote(issue_ref.strip(), safe="")
        url = f"{creds.base_url}/issues/{safe_ref}/attachments/"
        payload, boundary = self._build_upload_body(file_path, filename)
        file_size = file_path.stat().st_size
        timeout = max(
            settings.server.tracker_attachment_timeout_seconds,
            60 + file_size // (1024 * 1024),
        )
        raw, _ = self._client.request_bytes(
            "POST",
            url,
            data=payload,
            headers_extra={"Content-Type": f"multipart/form-data; boundary={boundary}"},
            timeout_seconds=timeout,
        )
        try:
            body = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise TrackerUnavailableError("tracker_invalid_json") from exc
        if not isinstance(body, dict):
            raise TrackerUnavailableError("tracker_attachment_response_invalid")
        return parse_attachment(body)

    def fetch_attachment_content(
        self,
        repair_request: RepairRequest,
        attachment_id: str,
        *,
        variant: str = "content",
    ) -> tuple[bytes, str | None]:
        ref = issue_ref_for(repair_request)
        if not ref:
            raise TrackerUnavailableError("tracker_issue_ref_missing")
        attachments = self.list_attachments(repair_request)
        match = next((a for a in attachments if a.id == attachment_id), None)
        if match is None:
            raise TrackerUnavailableError("tracker_attachment_not_found")
        url = match.thumbnail_url if variant == "thumbnail" else match.content_url
        if not url:
            raise TrackerUnavailableError("tracker_attachment_url_missing")
        creds = self.credentials()
        if url.startswith("/"):
            url = f"{creds.base_url.rstrip('/')}/{url.lstrip('/')}"
        return self._client.request_bytes("GET", url)

    def post_comment(self, issue_ref: str, text: str, *, markup_md: bool = True) -> None:
        ref = (issue_ref or "").strip()
        if not ref:
            raise TrackerUnavailableError("tracker_issue_ref_missing")
        if not (text or "").strip():
            raise TrackerUnavailableError("tracker_comment_text_empty")
        creds = self.credentials()
        url = f"{creds.base_url}/issues/{quote(ref, safe='')}/comments"
        payload: dict = {"text": text.strip()}
        if markup_md:
            payload["markupType"] = "md"
        self._client.request_json("POST", url, data=payload)

    def push_status_from_site(
        self,
        issue_ref: str,
        target_status_label: str,
        *,
        resolution: str | None = None,
    ) -> None:
        ref = (issue_ref or "").strip()
        target = (target_status_label or "").strip()
        if not ref or not target:
            raise TrackerUnavailableError("tracker_issue_ref_or_status_missing")
        creds = self.credentials()
        issue_body = self._client.request_json(
            "GET",
            f"{creds.base_url}/issues/{quote(ref, safe='')}/",
        )
        current = self._issue_status_label(issue_body)
        if current and self._labels_match(current, target):
            return

        transitions = self._list_transitions(creds, ref)
        for transition in transitions:
            label = self._transition_target_label(transition)
            tid = transition.get("id")
            if not tid or not label:
                continue
            if not self._labels_match(label, target):
                continue
            body: dict = {}
            if target == "Закрыт" and resolution and resolution.strip():
                body["resolution"] = resolution.strip()
            self._execute_transition(creds, ref, str(tid), body=body)
            return

        raise TrackerUnavailableError(f"tracker_transition_not_found:{target}")

    def post_site_user_comment(self, issue_ref: str, user: User, body: str) -> None:
        display = (user.full_name or "").strip() or user.login
        text = f"**{display}** (Fix My Kit):\n\n{(body or '').strip()}"
        self.post_comment(issue_ref, text)

    def push_publish_state_comment(self, issue_ref: str, is_published: bool) -> None:
        text = PUBLISH_TRACKER_COMMENT if is_published else UNPUBLISH_TRACKER_COMMENT
        self.post_comment(issue_ref, text)

    def push_sysadmin_taken_comment(self, issue_ref: str, *, taken: bool) -> None:
        text = SYSADMIN_TAKEN_TRACKER_COMMENT if taken else SYSADMIN_RETURNED_TRACKER_COMMENT
        self.post_comment(issue_ref, text)

    def _fetch_issue(self, creds: TrackerCredentials, issue_ref: str) -> TrackerIssueResult:
        url = f"{creds.base_url}/issues/{quote(str(issue_ref), safe='')}/"
        body = self._client.request_json("GET", url)
        return parse_issue_response(body)

    def _create_issue(self, repair_request: RepairRequest, creds: TrackerCredentials) -> TrackerIssueResult:
        payload = self._build_issue_payload(repair_request, creds.queue)
        url = f"{creds.base_url}/issues/"
        body = self._client.request_json("POST", url, data=payload)
        return parse_issue_response(body)

    @staticmethod
    def _requester_line(repair_request: RepairRequest) -> str:
        if repair_request.author_user_id is None:
            return (repair_request.applicant_name or "не указано").strip() or "не указано"
        author = repair_request.author
        if author is None:
            return "не указано"
        if author.full_name and author.full_name.strip():
            return author.full_name.strip()
        return (author.login or str(author.id)).strip()

    def _build_issue_payload(self, repair_request: RepairRequest, queue: str) -> dict:
        requester = self._requester_line(repair_request)
        desc_text = (repair_request.description or "—").strip() or "—"
        desc_lines = desc_text.splitlines()
        quoted_desc = "\n".join(f"> {line}" if line else ">" for line in desc_lines)

        if repair_request.audience_id is not None:
            audience = repair_request.audience
            cabinet_name = (
                audience.name.strip()
                if audience is not None and audience.name and audience.name.strip()
                else "—"
            )
            summary = f"Кабинет: {cabinet_name}"[:255]
            lines: list[str] = [
                "### Кабинет",
                f"- **Название:** {cabinet_name}",
                "",
                "### Заявитель",
                requester,
                "",
                "### Описание проблемы",
                quoted_desc,
                "",
                "### Ссылка на заявку в Fix My Kit",
                f"https://app.fixmykit.karasikoff.ru/requests/{repair_request.id}",
                "",
                "### Отладка",
                f"- **id заявки:** `{repair_request.id}`",
                f"- **id кабинета:** `{repair_request.audience_id}`",
            ]
        else:
            device = repair_request.device
            device_name = device.name if device is not None else "устройство (нет данных)"
            room_name = (
                device.audience.name
                if device is not None and device.audience is not None
                else None
            )
            inv = device.inventory_number if device is not None else None
            audience_display = (
                room_name.strip() if room_name and str(room_name).strip() else "—"
            )
            inv_display = inv if inv else "—"
            audience_part = (
                f", кабинет {room_name}"
                if room_name and str(room_name).strip()
                else ""
            )
            summary = f"Ремонт: {device_name}{audience_part}"[:255]
            lines = [
                "### Устройство",
                f"- **Название:** {device_name}",
                f"- **Кабинет:** {audience_display}",
                f"- **Инв. номер:** {inv_display}",
                "",
                "### Заявитель",
                requester,
                "",
                "### Описание проблемы",
                quoted_desc,
                "",
                "### Ссылка на заявку в Fix My Kit",
                f"https://app.fixmykit.karasikoff.ru/requests/{repair_request.id}",
                "",
                "### Отладка",
                f"- **id заявки:** `{repair_request.id}`",
                f"- **id устройства:** `{repair_request.device_id}`",
            ]

        if repair_request.author_user_id is not None:
            lines.append(f"- **id автора:** `{repair_request.author_user_id}`")

        return {
            "queue": queue,
            "summary": summary,
            "description": "\n".join(lines),
        }

    @staticmethod
    def _content_disposition_filename(filename: str) -> str:
        safe_ascii = filename.encode("ascii", "ignore").decode("ascii") or "file"
        encoded = urlquote(filename, safe="")
        return (
            f'form-data; name="file"; filename="{safe_ascii}"; '
            f"filename*=UTF-8''{encoded}"
        )

    def _build_upload_body(self, file_path: Path, filename: str) -> tuple[bytes, str]:
        body_bytes = file_path.read_bytes()
        mime = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        boundary = f"----FixMyKit{uuid4().hex}"
        disposition = self._content_disposition_filename(filename)
        payload = b"".join(
            [
                f"--{boundary}\r\n".encode(),
                f"Content-Disposition: {disposition}\r\n".encode(),
                f"Content-Type: {mime}\r\n\r\n".encode(),
                body_bytes,
                f"\r\n--{boundary}--\r\n".encode(),
            ]
        )
        return payload, boundary

    @staticmethod
    def _transition_target_label(transition: dict) -> str | None:
        to = transition.get("to")
        if isinstance(to, dict):
            for key in ("display", "name"):
                raw = to.get(key)
                if isinstance(raw, str) and raw.strip():
                    return raw.strip()
        display = transition.get("display")
        if isinstance(display, str) and display.strip():
            return display.strip()
        return None

    @staticmethod
    def _issue_status_label(issue_body: dict) -> str | None:
        status = issue_body.get("status")
        if isinstance(status, dict):
            for key in ("display", "name"):
                raw = status.get(key)
                if isinstance(raw, str) and raw.strip():
                    return raw.strip()
        if isinstance(status, str) and status.strip():
            return status.strip()
        status_type = issue_body.get("statusType")
        if isinstance(status_type, dict):
            for key in ("display", "name"):
                raw = status_type.get(key)
                if isinstance(raw, str) and raw.strip():
                    return raw.strip()
        return None

    @staticmethod
    def _labels_match(current: str, target: str) -> bool:
        """Сравнение отображаемых названий статусов Трекера"""
        return current.strip().casefold() == target.strip().casefold()

    def _list_transitions(self, creds: TrackerCredentials, issue_ref: str) -> list[dict]:
        url = f"{creds.base_url}/issues/{quote(issue_ref, safe='')}/transitions"
        raw = self._client.request_json_list("GET", url)
        return [row for row in raw if isinstance(row, dict)]

    def _execute_transition(
        self,
        creds: TrackerCredentials,
        issue_ref: str,
        transition_id: str,
        *,
        body: dict | None = None,
    ) -> None:
        safe_ref = quote(issue_ref, safe="")
        safe_tid = quote(str(transition_id), safe="")
        url = f"{creds.base_url}/issues/{safe_ref}/transitions/{safe_tid}/_execute"
        self._client.request_json("POST", url, data=body if body is not None else {})


_default_service: TrackerIssueService | None = None


def get_tracker_issue_service() -> TrackerIssueService:
    global _default_service
    if _default_service is None:
        _default_service = TrackerIssueService()
    return _default_service
