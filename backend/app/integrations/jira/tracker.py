"""Адаптер Jira → IssueTracker."""

from __future__ import annotations

from pathlib import Path

from backend.app.integrations.jira.issue_service import JiraIssueService, get_jira_issue_service
from backend.app.integrations.types import (
    ExternalAttachmentMeta,
    ExternalIssueResult,
)
from backend.app.models.repair_request import RepairRequest
from backend.app.models.user import User


class JiraIssueTracker:
    def __init__(self, service: JiraIssueService | None = None) -> None:
        self._service = service or get_jira_issue_service()

    def is_configured(self) -> bool:
        return self._service.is_configured()

    def sync_repair_request(self, repair_request: RepairRequest) -> ExternalIssueResult:
        return self._service.sync_repair_request(repair_request)

    def push_status(
        self,
        repair_request: RepairRequest,
        label: str,
        *,
        resolution: str | None = None,
    ) -> None:
        self._service.push_status(repair_request, label, resolution=resolution)

    def add_comment(
        self,
        repair_request: RepairRequest,
        body: str,
        *,
        markup_md: bool = True,
    ) -> None:
        self._service.add_comment(repair_request, body, markup_md=markup_md)

    def add_site_user_comment(
        self, repair_request: RepairRequest, user: User, body: str
    ) -> None:
        self._service.add_site_user_comment(repair_request, user, body)

    def push_publish_comment(
        self, repair_request: RepairRequest, *, is_published: bool
    ) -> None:
        self._service.push_publish_comment(repair_request, is_published=is_published)

    def push_sysadmin_taken_comment(
        self, repair_request: RepairRequest, *, taken: bool
    ) -> None:
        self._service.push_sysadmin_taken_comment(repair_request, taken=taken)

    def upload_attachment(
        self,
        repair_request: RepairRequest,
        *,
        file_path: str,
        filename: str,
    ) -> ExternalAttachmentMeta:
        return self._service.upload_attachment(
            repair_request,
            file_path=Path(file_path),
            filename=filename,
        )

    def list_attachments(
        self, repair_request: RepairRequest
    ) -> list[ExternalAttachmentMeta]:
        return self._service.list_attachments(repair_request)

    def fetch_attachment_content(
        self,
        repair_request: RepairRequest,
        attachment_id: str,
        *,
        variant: str = "content",
    ) -> tuple[bytes, str | None]:
        return self._service.fetch_attachment_content(
            repair_request, attachment_id, variant=variant
        )

    def status_comment_from_site(self, label: str) -> str:
        return self._service.status_comment_from_site(label)
