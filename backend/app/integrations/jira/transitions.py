"""Маппинг статусов Fix My Kit → transition id Jira."""

from __future__ import annotations

from urllib.parse import quote

from backend.app.core.config import ServerConfig, settings
from backend.app.integrations.jira.client import JiraClient, get_jira_client
from backend.app.models.enums import RequestStatus
from backend.app.services.repair_request_tracker_outbound import REQUEST_STATUS_TRACKER_LABEL

# Имена transition в Jira (рус./англ.) для fallback через GET …/transitions.
FMK_LABEL_TO_JIRA_TRANSITION_NAMES: dict[str, tuple[str, ...]] = {
    "Открыт": ("К выполнению", "To Do", "Open", "Открыт"),
    "В работе": ("В работе", "In Progress"),
    "Требуется информация": (
        "Требуется информация",
        "Waiting for customer",
        "Need info",
    ),
    "Закрыт": ("Решено", "Done", "Closed", "Закрыт", "Close"),
}


def transition_id_for_label(label: str, server: ServerConfig) -> str | None:
    target = (label or "").strip().casefold()
    if not target:
        return None
    for status, status_label in REQUEST_STATUS_TRACKER_LABEL.items():
        if status_label.strip().casefold() != target:
            continue
        return _transition_for_status(status, server)
    return None


def _transition_for_status(status: RequestStatus, server: ServerConfig) -> str | None:
    raw = {
        RequestStatus.OPEN: server.jira_transition_open,
        RequestStatus.IN_PROGRESS: server.jira_transition_in_progress,
        RequestStatus.NEEDS_INFO: server.jira_transition_needs_info,
        RequestStatus.CLOSED: server.jira_transition_closed,
    }.get(status)
    value = (raw or "").strip()
    return value or None


def _name_matches(label: str, candidate: str) -> bool:
    return candidate.strip().casefold() == label.strip().casefold()


def _transition_names_for_fmk_label(label: str) -> tuple[str, ...]:
    clean = (label or "").strip()
    if not clean:
        return ()
    if clean in FMK_LABEL_TO_JIRA_TRANSITION_NAMES:
        return FMK_LABEL_TO_JIRA_TRANSITION_NAMES[clean]
    return (clean,)


def find_transition_id_from_issue(
    client: JiraClient,
    issue_ref: str,
    label: str,
) -> str | None:
    """GET /issue/{ref}/transitions — подбор id по имени transition или целевого статуса."""
    url = (
        f"{client.api_base()}/issue/{quote(issue_ref, safe='')}/transitions"
    )
    body = client.request_json("GET", url)
    wanted = _transition_names_for_fmk_label(label)
    wanted_fold = {n.casefold() for n in wanted}

    for row in body.get("transitions") or []:
        if not isinstance(row, dict):
            continue
        tid = str(row.get("id") or "").strip()
        if not tid:
            continue
        tname = str(row.get("name") or "").strip()
        if tname.casefold() in wanted_fold:
            return tid
        to_status = row.get("to")
        if isinstance(to_status, dict):
            to_name = str(to_status.get("name") or "").strip()
            if to_name.casefold() in wanted_fold:
                return tid
    return None


def resolve_transition_id(
    issue_ref: str,
    label: str,
    *,
    client: JiraClient | None = None,
    server: ServerConfig | None = None,
) -> str | None:
    """Сначала JIRA_TRANSITION_* из env, иначе lookup по API."""
    cfg = server or settings.server
    configured = transition_id_for_label(label, cfg)
    jira_client = client or get_jira_client()
    if configured:
        return configured
    return find_transition_id_from_issue(jira_client, issue_ref, label)
