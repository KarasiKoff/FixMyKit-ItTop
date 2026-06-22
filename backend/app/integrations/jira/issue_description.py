"""ADF-описание задачи Jira для заявки Fix My Kit."""

from __future__ import annotations

from backend.app.core.config import settings
from backend.app.models.repair_request import RepairRequest


def _text(value: str, *, marks: list[dict] | None = None) -> dict:
    node: dict = {"type": "text", "text": value}
    if marks:
        node["marks"] = marks
    return node


def _strong(value: str) -> dict:
    return _text(value, marks=[{"type": "strong"}])


def _code(value: str) -> dict:
    return _text(value, marks=[{"type": "code"}])


def _link(text: str, href: str) -> dict:
    return _text(text, marks=[{"type": "link", "attrs": {"href": href}}])


def _heading(level: int, title: str) -> dict:
    return {
        "type": "heading",
        "attrs": {"level": level},
        "content": [_text(title)],
    }


def _paragraph(*nodes: dict) -> dict:
    return {"type": "paragraph", "content": list(nodes)}


def _bullet_item(*nodes: dict) -> dict:
    return {
        "type": "listItem",
        "content": [_paragraph(*nodes)],
    }


def _bullet_list(*items: dict) -> dict:
    return {"type": "bulletList", "content": list(items)}


def _labeled_bullet(label: str, value: str) -> dict:
    return _bullet_item(_strong(f"{label}: "), _text(value))


def _requester_line(repair_request: RepairRequest) -> str:
    if repair_request.author_user_id is None:
        return (repair_request.applicant_name or "не указано").strip() or "не указано"
    author = repair_request.author
    if author is None:
        return "не указано"
    if author.full_name and author.full_name.strip():
        return author.full_name.strip()
    return (author.login or str(author.id)).strip()


def _app_request_url(repair_request: RepairRequest) -> str:
    base = (settings.server.public_frontend_base_url or "").strip().rstrip("/")
    if not base:
        return f"/requests/{repair_request.id}"
    return f"{base}/requests/{repair_request.id}"


def build_issue_summary(repair_request: RepairRequest) -> str:
    if repair_request.audience_id is not None:
        audience = repair_request.audience
        cabinet_name = (
            audience.name.strip()
            if audience is not None and audience.name and audience.name.strip()
            else "—"
        )
        return f"Кабинет: {cabinet_name}"

    device = repair_request.device
    device_name = device.name if device is not None else "устройство (нет данных)"
    room_name = (
        device.audience.name
        if device is not None and device.audience is not None
        else None
    )
    audience_part = (
        f", кабинет {room_name}" if room_name and str(room_name).strip() else ""
    )
    return f"Ремонт: {device_name}{audience_part}"


def build_repair_request_description_adf(repair_request: RepairRequest) -> dict:
    """Структурированное описание задачи (без сырого markdown в тексте)."""
    requester = _requester_line(repair_request)
    desc_text = (repair_request.description or "—").strip() or "—"
    request_url = _app_request_url(repair_request)
    content: list[dict] = []

    if repair_request.audience_id is not None:
        audience = repair_request.audience
        cabinet_name = (
            audience.name.strip()
            if audience is not None and audience.name and audience.name.strip()
            else "—"
        )
        content.extend(
            [
                _heading(3, "Кабинет"),
                _bullet_list(_labeled_bullet("Название", cabinet_name)),
            ]
        )
        debug_bullets = [
            _labeled_bullet("id заявки", str(repair_request.id)),
            _labeled_bullet("id кабинета", str(repair_request.audience_id)),
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
        content.extend(
            [
                _heading(3, "Устройство"),
                _bullet_list(
                    _labeled_bullet("Название", device_name),
                    _labeled_bullet("Кабинет", audience_display),
                    _labeled_bullet("Инв. номер", inv_display),
                ),
            ]
        )
        debug_bullets = [
            _labeled_bullet("id заявки", str(repair_request.id)),
            _labeled_bullet(
                "id устройства",
                str(repair_request.device_id) if repair_request.device_id else "—",
            ),
        ]

    content.extend(
        [
            _heading(3, "Заявитель"),
            _paragraph(_text(requester)),
            _heading(3, "Описание проблемы"),
            _paragraph(_text(desc_text)),
            _heading(3, "Fix My Kit"),
            _paragraph(
                _link("Открыть заявку на сайте", request_url),
                _text(" "),
                _text("("),
                _code(request_url),
                _text(")"),
            ),
            _heading(4, "Отладка"),
            _bullet_list(*debug_bullets),
        ]
    )

    return {"type": "doc", "version": 1, "content": content}


def default_issue_labels() -> list[str]:
    raw = settings.server.jira_issue_label
    if raw is None:
        raw = "fmk"
    raw = raw.strip()
    if not raw:
        return []
    return [part.strip() for part in raw.split(",") if part.strip()]
