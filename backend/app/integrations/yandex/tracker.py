"""Адаптер Yandex Tracker -> IssueTracker."""

from __future__ import annotations

from pathlib import Path

from backend.app.clients.tracker_client import TrackerUnavailableError
from backend.app.integrations.types import (
    ExternalAttachmentMeta,
    ExternalIssueResult,
    IssueTrackerUnavailableError,
)
from backend.app.models.repair_request import RepairRequest
from backend.app.models.user import User
from backend.app.services.tracker_issue_service import (
    TrackerIssueService,
    get_tracker_issue_service,
    tracker_comment_status_from_site,
)
from backend.app.services.tracker_types import issue_ref_for, parse_attachment


class YandexIssueTracker:
    def __init__(self, service: TrackerIssueService | None = None) -> None:
        self._service = service or get_tracker_issue_service()

    def is_configured(self) -> bool:
        try:
            self._service.credentials()
            return True
        except TrackerUnavailableError:
            return False

    def sync_repair_request(self, repair_request: RepairRequest) -> ExternalIssueResult:
        try:
            result = self._service.sync_repair_request(repair_request)
        except TrackerUnavailableError as exc:
            raise IssueTrackerUnavailableError(exc.message) from exc
        return ExternalIssueResult(
            ticket_id=result.ticket_id,
            ticket_key=result.ticket_key,
            ticket_url=result.ticket_url,
            synced_at=result.synced_at,
        )

    def _issue_ref(self, repair_request: RepairRequest) -> str:
        ref = issue_ref_for(repair_request)
        if not ref:
            raise IssueTrackerUnavailableError("tracker_issue_ref_missing")
        return ref

    def push_status(
        self,
        repair_request: RepairRequest,
        label: str,
        *,
        resolution: str | None = None,
    ) -> None:
        ref = self._issue_ref(repair_request)
        try:
            self._service.push_status_from_site(ref, label, resolution=resolution)
        except TrackerUnavailableError as exc:
            raise IssueTrackerUnavailableError(exc.message) from exc

    def add_comment(
        self,
        repair_request: RepairRequest,
        body: str,
        *,
        markup_md: bool = True,
    ) -> None:
        ref = self._issue_ref(repair_request)
        try:
            self._service.post_comment(ref, body, markup_md=markup_md)
        except TrackerUnavailableError as exc:
            raise IssueTrackerUnavailableError(exc.message) from exc

    def add_site_user_comment(
        self, repair_request: RepairRequest, user: User, body: str
    ) -> None:
        ref = self._issue_ref(repair_request)
        try:
            self._service.post_site_user_comment(ref, user, body)
        except TrackerUnavailableError as exc:
            raise IssueTrackerUnavailableError(exc.message) from exc

    def push_publish_comment(
        self, repair_request: RepairRequest, *, is_published: bool
    ) -> None:
        ref = self._issue_ref(repair_request)
        try:
            self._service.push_publish_state_comment(ref, is_published)
        except TrackerUnavailableError as exc:
            raise IssueTrackerUnavailableError(exc.message) from exc

    def push_sysadmin_taken_comment(
        self, repair_request: RepairRequest, *, taken: bool
    ) -> None:
        ref = self._issue_ref(repair_request)
        try:
            self._service.push_sysadmin_taken_comment(ref, taken=taken)
        except TrackerUnavailableError as exc:
            raise IssueTrackerUnavailableError(exc.message) from exc

    def upload_attachment(
        self,
        repair_request: RepairRequest,
        *,
        file_path: str,
        filename: str,
    ) -> ExternalAttachmentMeta:
        ref = self._issue_ref(repair_request)
        try:
            row = self._service.upload_attachment(
                ref, file_path=Path(file_path), filename=filename
            )
        except TrackerUnavailableError as exc:
            raise IssueTrackerUnavailableError(exc.message) from exc
        return ExternalAttachmentMeta(
            id=row.id,
            name=row.name,
            mimetype=row.mimetype,
            size=row.size,
            thumbnail_url=row.thumbnail_url,
            content_url=row.content_url,
            created_at=row.created_at,
        )

    def list_attachments(
        self, repair_request: RepairRequest
    ) -> list[ExternalAttachmentMeta]:
        try:
            rows = self._service.list_attachments(repair_request)
        except TrackerUnavailableError as exc:
            raise IssueTrackerUnavailableError(exc.message) from exc
        return [
            ExternalAttachmentMeta(
                id=row.id,
                name=row.name,
                mimetype=row.mimetype,
                size=row.size,
                thumbnail_url=row.thumbnail_url,
                content_url=row.content_url,
                created_at=row.created_at,
            )
            for row in rows
        ]

    def fetch_attachment_content(
        self,
        repair_request: RepairRequest,
        attachment_id: str,
        *,
        variant: str = "content",
    ) -> tuple[bytes, str | None]:
        try:
            return self._service.fetch_attachment_content(
                repair_request, attachment_id, variant=variant
            )
        except TrackerUnavailableError as exc:
            raise IssueTrackerUnavailableError(exc.message) from exc

    def status_comment_from_site(self, label: str) -> str:
        return tracker_comment_status_from_site(label)
