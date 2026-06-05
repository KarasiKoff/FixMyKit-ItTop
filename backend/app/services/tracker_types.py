"""Типы и чистые хелперы для интеграции с Yandex Tracker."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from backend.app.clients.tracker_client import TrackerUnavailableError
from backend.app.models.repair_request import RepairRequest


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


def issue_ref_for(repair_request: RepairRequest) -> str | None:
    ref = (
        repair_request.tracker_ticket_key or repair_request.tracker_ticket_id or ""
    ).strip()
    return ref or None


def parse_issue_response(body: dict) -> TrackerIssueResult:
    ticket_id = str(body.get("id") or "")
    ticket_key = str(body.get("key") or "")
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


def parse_attachment(item: dict) -> TrackerAttachmentMeta:
    return TrackerAttachmentMeta(
        id=str(item.get("id") or ""),
        name=str(item.get("name") or "file"),
        mimetype=(str(item["mimetype"]) if item.get("mimetype") else None),
        size=int(item["size"]) if item.get("size") is not None else None,
        thumbnail_url=str(item["thumbnail"]) if item.get("thumbnail") else None,
        content_url=str(item["content"]) if item.get("content") else None,
        created_at=str(item["createdAt"]) if item.get("createdAt") else None,
    )
