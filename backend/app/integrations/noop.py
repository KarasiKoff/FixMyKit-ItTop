"""Провайдер-заглушка: Fix My Kit без внешнего трекера."""

from __future__ import annotations

from backend.app.integrations.types import (
    ExternalAttachmentMeta,
    ExternalIssueResult,
    IssueTrackerUnavailableError,
)
from backend.app.models.repair_request import RepairRequest
from backend.app.models.user import User


class NoOpIssueTracker:
    def is_configured(self) -> bool:
        return False

    def _disabled(self) -> IssueTrackerUnavailableError:
        return IssueTrackerUnavailableError("external_tracker_disabled")

    def sync_repair_request(self, repair_request: RepairRequest) -> ExternalIssueResult:
        raise self._disabled()

    def push_status(
        self,
        repair_request: RepairRequest,
        label: str,
        *,
        resolution: str | None = None,
    ) -> None:
        return None

    def add_comment(
        self,
        repair_request: RepairRequest,
        body: str,
        *,
        markup_md: bool = True,
    ) -> None:
        return None

    def add_site_user_comment(
        self, repair_request: RepairRequest, user: User, body: str
    ) -> None:
        return None

    def push_publish_comment(
        self, repair_request: RepairRequest, *, is_published: bool
    ) -> None:
        return None

    def push_sysadmin_taken_comment(
        self, repair_request: RepairRequest, *, taken: bool
    ) -> None:
        return None

    def upload_attachment(
        self,
        repair_request: RepairRequest,
        *,
        file_path: str,
        filename: str,
    ) -> ExternalAttachmentMeta:
        raise self._disabled()

    def list_attachments(
        self, repair_request: RepairRequest
    ) -> list[ExternalAttachmentMeta]:
        return []

    def fetch_attachment_content(
        self,
        repair_request: RepairRequest,
        attachment_id: str,
        *,
        variant: str = "content",
    ) -> tuple[bytes, str | None]:
        raise self._disabled()

    def status_comment_from_site(self, label: str) -> str:
        return label
