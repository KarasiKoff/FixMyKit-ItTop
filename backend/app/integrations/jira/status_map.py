"""Маппинг имён статусов Jira → RequestStatus (JIRA_STATUS_MAP)."""

from __future__ import annotations

import json
import logging

from backend.app.core.config import ServerConfig, settings
from backend.app.models.enums import RequestStatus

logger = logging.getLogger(__name__)

_JIRA_STATUS_VALUE_MAP: dict[str, RequestStatus] = {
    "open": RequestStatus.OPEN,
    "in_progress": RequestStatus.IN_PROGRESS,
    "needs_info": RequestStatus.NEEDS_INFO,
    "closed": RequestStatus.CLOSED,
}


def parse_jira_status_map(raw_json: str) -> dict[str, RequestStatus]:
    text = (raw_json or "").strip() or "{}"
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        logger.warning("jira_status_map_invalid_json")
        return {}
    if not isinstance(data, dict):
        logger.warning("jira_status_map_not_object")
        return {}
    result: dict[str, RequestStatus] = {}
    for key, value in data.items():
        name = str(key).strip()
        token = str(value).strip().lower()
        if not name or token not in _JIRA_STATUS_VALUE_MAP:
            continue
        result[name] = _JIRA_STATUS_VALUE_MAP[token]
    return result


def jira_status_map(server: ServerConfig | None = None) -> dict[str, RequestStatus]:
    cfg = server or settings.server
    return parse_jira_status_map(cfg.jira_status_map_json)


def map_jira_status_to_request(
    raw: str, server: ServerConfig | None = None
) -> RequestStatus | None:
    name = (raw or "").strip()
    if not name:
        return None
    return jira_status_map(server).get(name)
