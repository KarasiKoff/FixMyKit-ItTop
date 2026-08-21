"""Дополнительные поля при создании задачи Jira из Fix My Kit."""

from __future__ import annotations

import json
from datetime import UTC, datetime

from backend.app.core.config import ServerConfig, settings
from backend.app.models.repair_request import RepairRequest


def build_create_issue_extra_fields(
    repair_request: RepairRequest,
    server: ServerConfig | None = None,
) -> dict:
    """Поля вроде даты начала и Team — по env (id кастомных полей Jira)."""
    cfg = server or settings.server
    extra: dict = {}

    start_field = (cfg.jira_create_start_date_field or "").strip()
    if start_field and cfg.jira_create_set_start_date:
        extra[start_field] = _start_date_value(repair_request)

    team_field = (cfg.jira_create_team_field or "").strip()
    team_id = (cfg.jira_create_team_id or "").strip()
    if team_field and team_id:
        extra[team_field] = team_id

    extra.update(_parse_extra_fields_json(cfg.jira_create_fields_json))
    return extra


def _start_date_value(repair_request: RepairRequest) -> str:
    dt = repair_request.created_at or datetime.now(UTC)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC).date().isoformat()


def _parse_extra_fields_json(raw: str) -> dict:
    text = (raw or "").strip()
    if not text or text == "{}":
        return {}
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return {}
    if not isinstance(parsed, dict):
        return {}
    return {str(k): v for k, v in parsed.items()}
