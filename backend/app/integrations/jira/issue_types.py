"""Резолв типа задачи Jira для create issue (имя, id, createmeta)."""

from __future__ import annotations

import logging

from backend.app.core.config import ServerConfig, settings
from backend.app.integrations.jira.client import JiraClient, get_jira_client
from backend.app.integrations.types import IssueTrackerUnavailableError

logger = logging.getLogger("fixmykit.jira")


def _issue_type_aliases(name: str) -> set[str]:
    base = name.strip().casefold()
    aliases = {base}
    if base == "task":
        aliases.update({"задание", "задача", "task", "issue"})
    if base in {"задание", "задача"}:
        aliases.update({"зadanie", "задача", "task", "issue"})
    return aliases


def _pick_default_issue_type(types: list[dict]) -> dict | None:
    for row in types:
        if row.get("subtask"):
            continue
        name = str(row.get("name") or "").casefold()
        if name == "epic":
            continue
        return row
    return types[0] if types else None


def _fetch_project_issue_types(client: JiraClient, project_key: str) -> list[dict]:
    creds = client.credentials()
    url = (
        f"{creds.api_base.rstrip('/')}/issue/createmeta"
        f"?projectKeys={project_key}&expand=projects.issuetypes"
    )
    body = client.request_json("GET", url)
    for project in body.get("projects") or []:
        if str(project.get("key") or "").strip() != project_key:
            continue
        types = project.get("issuetypes") or []
        if not isinstance(types, list):
            break
        return [t for t in types if isinstance(t, dict)]
    return []


def resolve_issue_type_field(
    client: JiraClient | None = None,
    server: ServerConfig | None = None,
) -> dict[str, str]:
    """
    Поле issuetype для POST /issue: {"id": "..."} или {"name": "..."}.
    Приоритет: JIRA_ISSUE_TYPE_ID → JIRA_ISSUE_TYPE (имя) → createmeta.
    """
    cfg = server or settings.server
    jira_client = client or get_jira_client()
    type_id = (cfg.jira_issue_type_id or "").strip()
    if type_id:
        return {"id": type_id}

    creds = jira_client.credentials()
    configured_name = (cfg.jira_issue_type or "").strip()
    types = _fetch_project_issue_types(jira_client, creds.project_key)

    if configured_name:
        wanted = _issue_type_aliases(configured_name)
        for row in types:
            name = str(row.get("name") or "").strip()
            if name.casefold() in wanted or name == configured_name:
                rid = str(row.get("id") or "").strip()
                if rid:
                    return {"id": rid}
                return {"name": name}

    fallback = _pick_default_issue_type(types)
    if fallback is None:
        raise IssueTrackerUnavailableError(
            f"jira_issue_type_not_found: project={creds.project_key} "
            f"configured={configured_name or '—'}"
        )

    rid = str(fallback.get("id") or "").strip()
    name = str(fallback.get("name") or "").strip()
    logger.info(
        "jira_issue_type_fallback",
        extra={
            "project": creds.project_key,
            "issue_type_id": rid or None,
            "issue_type_name": name or None,
            "configured": configured_name or None,
        },
    )
    if rid:
        return {"id": rid}
    if name:
        return {"name": name}
    raise IssueTrackerUnavailableError("jira_issue_type_not_found")


def reset_issue_type_cache() -> None:
    return
