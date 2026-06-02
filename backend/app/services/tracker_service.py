from __future__ import annotations

import json
import mimetypes
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4
from urllib import error, request
from urllib.parse import quote
from urllib.parse import quote as urlquote

from backend.app.core.config import settings
from backend.app.models.repair_request import RepairRequest
from backend.app.models.user import User


class TrackerUnavailableError(Exception):
    """Ошибка сети, HTTP или неожиданный ответ Tracker."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


@dataclass(frozen=True)
class TrackerIssueResult:
    ticket_id: str
    ticket_key: str
    ticket_url: str
    synced_at: datetime


@dataclass(frozen=True)
class TrackerAttachmentMeta:
    id: str
    name: str
    mimetype: str | None
    size: int | None
    thumbnail_url: str | None
    content_url: str | None
    created_at: str | None


def _require_tracker_config() -> tuple[str, str, str, str]:
    s = settings.server
    if not s.tracker_token:
        raise TrackerUnavailableError("TRACKER_TOKEN is not set")
    if not s.tracker_org_id:
        raise TrackerUnavailableError("TRACKER_ORG_ID is not set")
    if not s.tracker_queue:
        raise TrackerUnavailableError("TRACKER_QUEUE is not set")
    base = s.tracker_base_url.rstrip("/")
    return base, s.tracker_token, s.tracker_org_id, s.tracker_queue


def _tracker_headers(
    token: str, org_id: str, *, json_body: bool = False
) -> dict[str, str]:
    headers: dict[str, str] = {
        "Authorization": f"OAuth {token}",
        "X-Cloud-Org-ID": org_id,
    }
    if json_body:
        headers["Content-Type"] = "application/json"
    return headers


def _parse_issue_response(body: dict) -> TrackerIssueResult:
    ticket_id = str(body.get("id") or "")
    ticket_key = str(body.get("key") or "")
    # В ответе API поле self - URL вида api.tracker.yandex.net/.../issues/KEY; для UI нужна ссылка на веб-Tracker.
    if ticket_key:
        ticket_url = f"https://tracker.yandex.ru/{ticket_key}"
    else:
        ticket_url = str(body.get("self") or "")
    if not ticket_id or not ticket_key or not ticket_url:
        raise TrackerUnavailableError("tracker_response_missing_fields")
    return TrackerIssueResult(
        ticket_id=ticket_id,
        ticket_key=ticket_key,
        ticket_url=ticket_url,
        synced_at=datetime.now(UTC),
    )


def _request_json(
    method: str,
    url: str,
    *,
    token: str,
    org_id: str,
    data: dict | None = None,
) -> dict:
    payload = json.dumps(data).encode("utf-8") if data is not None else None
    req = request.Request(
        url,
        data=payload,
        method=method,
        headers=_tracker_headers(token, org_id, json_body=data is not None),
    )
    timeout = settings.server.tracker_timeout_seconds
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except error.HTTPError as exc:
        text = exc.read().decode("utf-8", errors="replace")
        raise TrackerUnavailableError(f"tracker_http_{exc.code}: {text}") from exc
    except error.URLError as exc:
        raise TrackerUnavailableError(f"tracker_network: {exc.reason}") from exc
    except json.JSONDecodeError as exc:
        raise TrackerUnavailableError("tracker_invalid_json") from exc


def _request_bytes(
    method: str,
    url: str,
    *,
    token: str,
    org_id: str,
    data: bytes | None = None,
    headers_extra: dict[str, str] | None = None,
    timeout_seconds: int | None = None,
) -> tuple[bytes, str | None]:
    headers = _tracker_headers(token, org_id, json_body=False)
    if headers_extra:
        headers.update(headers_extra)
    req = request.Request(url, data=data, method=method, headers=headers)
    timeout = timeout_seconds if timeout_seconds is not None else settings.server.tracker_timeout_seconds
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            content_type = resp.headers.get("Content-Type")
            return resp.read(), content_type
    except error.HTTPError as exc:
        text = exc.read().decode("utf-8", errors="replace")
        raise TrackerUnavailableError(f"tracker_http_{exc.code}: {text}") from exc
    except error.URLError as exc:
        raise TrackerUnavailableError(f"tracker_network: {exc.reason}") from exc


def _request_json_list(
    method: str,
    url: str,
    *,
    token: str,
    org_id: str,
) -> list:
    raw, _ = _request_bytes(method, url, token=token, org_id=org_id)
    try:
        body = json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise TrackerUnavailableError("tracker_invalid_json") from exc
    if not isinstance(body, list):
        raise TrackerUnavailableError("tracker_expected_list")
    return body


def _parse_attachment(item: dict) -> TrackerAttachmentMeta:
    return TrackerAttachmentMeta(
        id=str(item.get("id") or ""),
        name=str(item.get("name") or "file"),
        mimetype=(str(item["mimetype"]) if item.get("mimetype") else None),
        size=int(item["size"]) if item.get("size") is not None else None,
        thumbnail_url=str(item["thumbnail"]) if item.get("thumbnail") else None,
        content_url=str(item["content"]) if item.get("content") else None,
        created_at=str(item["createdAt"]) if item.get("createdAt") else None,
    )


def issue_ref_for(repair_request: RepairRequest) -> str | None:
    ref = (repair_request.tracker_ticket_key or repair_request.tracker_ticket_id or "").strip()
    return ref or None


def list_issue_attachments(repair_request: RepairRequest) -> list[TrackerAttachmentMeta]:
    ref = issue_ref_for(repair_request)
    if not ref:
        return []
    base_url, token, org_id, _ = _require_tracker_config()
    safe_ref = quote(ref, safe="")
    url = f"{base_url}/issues/{safe_ref}/attachments"
    items = _request_json_list("GET", url, token=token, org_id=org_id)
    return [_parse_attachment(row) for row in items if isinstance(row, dict) and row.get("id")]


def _content_disposition_filename(filename: str) -> str:
    """RFC 5987 для не-ASCII имён файлов."""
    safe_ascii = filename.encode("ascii", "ignore").decode("ascii") or "file"
    encoded = urlquote(filename, safe="")
    return (
        f'form-data; name="file"; filename="{safe_ascii}"; '
        f"filename*=UTF-8''{encoded}"
    )


def _build_tracker_upload_body(file_path: Path, filename: str) -> tuple[bytes, str]:
    """multipart/form-data для Tracker API."""
    body_bytes = file_path.read_bytes()
    mime = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    boundary = f"----FixMyKit{uuid4().hex}"
    disposition = _content_disposition_filename(filename)
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


def upload_issue_attachment(
    issue_ref: str,
    *,
    file_path: Path,
    filename: str,
) -> TrackerAttachmentMeta:
    base_url, token, org_id, _ = _require_tracker_config()
    safe_ref = quote(issue_ref.strip(), safe="")
    url = f"{base_url}/issues/{safe_ref}/attachments/"
    payload, boundary = _build_tracker_upload_body(file_path, filename)
    file_size = file_path.stat().st_size
    timeout = max(
        settings.server.tracker_attachment_timeout_seconds,
        60 + file_size // (1024 * 1024),
    )
    raw, _ = _request_bytes(
        "POST",
        url,
        token=token,
        org_id=org_id,
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
    return _parse_attachment(body)


def fetch_attachment_content(
    repair_request: RepairRequest,
    attachment_id: str,
    *,
    variant: str = "content",
) -> tuple[bytes, str | None]:
    ref = issue_ref_for(repair_request)
    if not ref:
        raise TrackerUnavailableError("tracker_issue_ref_missing")
    attachments = list_issue_attachments(repair_request)
    match = next((a for a in attachments if a.id == attachment_id), None)
    if match is None:
        raise TrackerUnavailableError("tracker_attachment_not_found")
    url = match.thumbnail_url if variant == "thumbnail" else match.content_url
    if not url:
        raise TrackerUnavailableError("tracker_attachment_url_missing")
    base_url, token, org_id, _ = _require_tracker_config()
    if url.startswith("/"):
        url = f"{base_url.rstrip('/')}/{url.lstrip('/')}"
    return _request_bytes("GET", url, token=token, org_id=org_id)


def _requester_line(repair_request: RepairRequest) -> str:
    """Публичная заявка — applicant_name; из под учётки — ФИО (или логин) автора."""
    if repair_request.author_user_id is None:
        return (repair_request.applicant_name or "не указано").strip() or "не указано"
    author = repair_request.author
    if author is None:
        return "не указано"
    if author.full_name and author.full_name.strip():
        return author.full_name.strip()
    return (author.login or str(author.id)).strip()


def _build_issue_payload(repair_request: RepairRequest, queue: str) -> dict:
    device = repair_request.device
    device_name = device.name if device is not None else "устройство (нет данных)"
    audience_name = (
        device.audience.name
        if device is not None and device.audience is not None
        else None
    )
    inv = device.inventory_number if device is not None else None
    audience_display = (
        audience_name.strip() if audience_name and str(audience_name).strip() else "—"
    )
    inv_display = inv if inv else "—"

    audience_part = (
        f", аудитория {audience_name}"
        if audience_name and str(audience_name).strip()
        else ""
    )
    summary = f"Ремонт: {device_name}{audience_part}"
    summary = summary[:255]

    requester = _requester_line(repair_request)

    desc_text = (repair_request.description or "—").strip() or "—"
    desc_lines = desc_text.splitlines()
    quoted_desc = "\n".join(f"> {line}" if line else ">" for line in desc_lines)

    lines: list[str] = [
        "### Устройство",
        f"- **Название:** {device_name}",
        f"- **Аудитория:** {audience_display}",
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


def _fetch_issue(
    base_url: str, token: str, org_id: str, issue_ref: str
) -> TrackerIssueResult:
    safe_ref = quote(str(issue_ref), safe="")
    url = f"{base_url}/issues/{safe_ref}/"
    body = _request_json("GET", url, token=token, org_id=org_id)
    return _parse_issue_response(body)


def _create_issue(repair_request: RepairRequest) -> TrackerIssueResult:
    base_url, token, org_id, queue = _require_tracker_config()
    payload = _build_issue_payload(repair_request, queue)
    url = f"{base_url}/issues/"
    body = _request_json("POST", url, token=token, org_id=org_id, data=payload)
    return _parse_issue_response(body)


def sync_repair_request_to_tracker(repair_request: RepairRequest) -> TrackerIssueResult:
    """Создаёт задачу в Tracker или подтверждает существующую по ключу/id в БД."""
    base_url, token, org_id, _queue = _require_tracker_config()
    issue_ref = repair_request.tracker_ticket_key or repair_request.tracker_ticket_id
    if issue_ref:
        return _fetch_issue(base_url, token, org_id, issue_ref)
    return _create_issue(repair_request)


def yfm_red(text: str) -> str:
    """Красный текст в комментарии Tracker (YFM, markupType=md)"""
    return f"{{red}}({text})"


def tracker_comment_status_sync(tracker_status_label: str) -> str:
    """Комментарий после синхронизации статуса из вебхука"""
    label = (tracker_status_label or "").strip() or "—"
    return yfm_red(f"В Fix My Kit синхронизирован статус заявки: **{label}**")


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


def post_issue_comment(issue_ref: str, text: str, *, markup_md: bool = True) -> None:
    """Комментарий в задачу от имени OAuth-токена"""
    ref = (issue_ref or "").strip()
    if not ref:
        raise TrackerUnavailableError("tracker_issue_ref_missing")
    if not (text or "").strip():
        raise TrackerUnavailableError("tracker_comment_text_empty")
    base_url, token, org_id, _ = _require_tracker_config()
    safe_ref = quote(ref, safe="")
    url = f"{base_url}/issues/{safe_ref}/comments"
    payload: dict = {"text": text.strip()}
    if markup_md:
        payload["markupType"] = "md"
    _request_json("POST", url, token=token, org_id=org_id, data=payload)


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


def _labels_match(current: str, target: str) -> bool:
    c = current.strip().casefold()
    t = target.strip().casefold()
    if c == t:
        return True
    if t == "в работе" and c in ("в работе", "требуется информация"):
        return True
    return False


def _list_issue_transitions(base_url: str, token: str, org_id: str, issue_ref: str) -> list[dict]:
    safe_ref = quote(issue_ref, safe="")
    url = f"{base_url}/issues/{safe_ref}/transitions"
    raw = _request_json_list("GET", url, token=token, org_id=org_id)
    return [row for row in raw if isinstance(row, dict)]


def _execute_issue_transition(
    base_url: str,
    token: str,
    org_id: str,
    issue_ref: str,
    transition_id: str,
    *,
    body: dict | None = None,
) -> None:
    safe_ref = quote(issue_ref, safe="")
    safe_tid = quote(str(transition_id), safe="")
    url = f"{base_url}/issues/{safe_ref}/transitions/{safe_tid}/_execute"
    _request_json("POST", url, token=token, org_id=org_id, data=body if body is not None else {})


def push_issue_status_from_site(
    issue_ref: str,
    target_status_label: str,
    *,
    resolution: str | None = None,
) -> None:
    """Переводит задачу в статус по русской метке (как в вебхуках)."""
    ref = (issue_ref or "").strip()
    target = (target_status_label or "").strip()
    if not ref or not target:
        raise TrackerUnavailableError("tracker_issue_ref_or_status_missing")
    base_url, token, org_id, _ = _require_tracker_config()
    issue_body = _request_json(
        "GET",
        f"{base_url}/issues/{quote(ref, safe='')}/",
        token=token,
        org_id=org_id,
    )
    current = _issue_status_label(issue_body)
    if current and _labels_match(current, target):
        return

    transitions = _list_issue_transitions(base_url, token, org_id, ref)
    for transition in transitions:
        label = _transition_target_label(transition)
        tid = transition.get("id")
        if not tid or not label:
            continue
        if not _labels_match(label, target):
            continue
        body: dict = {}
        # resolution — ключ резолюции в API Трекера (fixed, wontFix)
        if target == "Закрыт" and resolution and resolution.strip():
            body["resolution"] = resolution.strip()
        _execute_issue_transition(
            base_url,
            token,
            org_id,
            ref,
            str(tid),
            body=body,
        )
        return

    raise TrackerUnavailableError(f"tracker_transition_not_found:{target}")


def tracker_comment_status_from_site(target_status_label: str) -> str:
    label = (target_status_label or "").strip() or "—"
    return yfm_red(f"Статус изменён в Fix My Kit: **{label}**")


def post_site_user_comment(issue_ref: str, user: User, body: str) -> None:
    display = (user.full_name or "").strip() or user.login
    text = f"**{display}** (Fix My Kit):\n\n{(body or '').strip()}"
    post_issue_comment(issue_ref, text)


def push_publish_state_comment(issue_ref: str, is_published: bool) -> None:
    text = PUBLISH_TRACKER_COMMENT if is_published else UNPUBLISH_TRACKER_COMMENT
    post_issue_comment(issue_ref, text)


def push_sysadmin_taken_comment(issue_ref: str, *, taken: bool) -> None:
    text = SYSADMIN_TAKEN_TRACKER_COMMENT if taken else SYSADMIN_RETURNED_TRACKER_COMMENT
    post_issue_comment(issue_ref, text)
