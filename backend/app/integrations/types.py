"""Общие типы интеграции с внешним трекером задач (Jira, Yandex Tracker)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from backend.app.clients.tracker_client import TrackerUnavailableError
from backend.app.models.repair_request import RepairRequest
from backend.app.models.user import User

# Алиас для обратной совместимости с Yandex-клиентом и существующими тестами.
IssueTrackerUnavailableError = TrackerUnavailableError


@dataclass(frozen=True)
class ExternalIssueResult:
    ticket_id: str
    ticket_key: str
    ticket_url: str
    synced_at: datetime


@dataclass(frozen=True)
class ExternalAttachmentMeta:
    id: str
    name: str
    mimetype: str | None
    size: int | None
    thumbnail_url: str | None
    content_url: str | None
    created_at: str | None


class IssueTracker(Protocol):
    """Контракт провайдера внешнего тикета (один на инстанс)."""

    def is_configured(self) -> bool: ...

    def sync_repair_request(self, repair_request: RepairRequest) -> ExternalIssueResult: ...

    def push_status(
        self,
        repair_request: RepairRequest,
        label: str,
        *,
        resolution: str | None = None,
    ) -> None: ...

    def add_comment(
        self,
        repair_request: RepairRequest,
        body: str,
        *,
        markup_md: bool = True,
    ) -> None: ...

    def add_site_user_comment(
        self, repair_request: RepairRequest, user: User, body: str
    ) -> None: ...

    def push_publish_comment(
        self, repair_request: RepairRequest, *, is_published: bool
    ) -> None: ...

    def push_sysadmin_taken_comment(
        self, repair_request: RepairRequest, *, taken: bool
    ) -> None: ...

    def upload_attachment(
        self,
        repair_request: RepairRequest,
        *,
        file_path: str,
        filename: str,
    ) -> ExternalAttachmentMeta: ...

    def list_attachments(
        self, repair_request: RepairRequest
    ) -> list[ExternalAttachmentMeta]: ...

    def fetch_attachment_content(
        self,
        repair_request: RepairRequest,
        attachment_id: str,
        *,
        variant: str = "content",
    ) -> tuple[bytes, str | None]: ...

    def status_comment_from_site(self, label: str) -> str: ...
