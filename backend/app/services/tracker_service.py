"""
Фасад интеграции с Yandex Tracker.

HTTP — clients/tracker_client.py, домен задач — tracker_issue_service.py.
Импорты из этого модуля сохранены для обратной совместимости.
"""

from __future__ import annotations

from pathlib import Path

from backend.app.clients.tracker_client import TrackerUnavailableError
from backend.app.models.repair_request import RepairRequest
from backend.app.models.user import User
from backend.app.services.tracker_issue_service import (
    PUBLISH_TRACKER_COMMENT,
    SYSADMIN_RETURNED_TRACKER_COMMENT,
    SYSADMIN_TAKEN_TRACKER_COMMENT,
    UNPUBLISH_TRACKER_COMMENT,
    TrackerIssueService,
    get_tracker_issue_service,
    tracker_comment_status_from_site,
    tracker_comment_status_sync,
    yfm_red,
)
from backend.app.services.tracker_types import (
    TrackerAttachmentMeta,
    TrackerIssueResult,
    issue_ref_for,
)

__all__ = [
    "PUBLISH_TRACKER_COMMENT",
    "SYSADMIN_RETURNED_TRACKER_COMMENT",
    "SYSADMIN_TAKEN_TRACKER_COMMENT",
    "UNPUBLISH_TRACKER_COMMENT",
    "TrackerAttachmentMeta",
    "TrackerIssueResult",
    "TrackerIssueService",
    "TrackerUnavailableError",
    "fetch_attachment_content",
    "get_tracker_issue_service",
    "issue_ref_for",
    "list_issue_attachments",
    "post_issue_comment",
    "post_site_user_comment",
    "push_issue_status_from_site",
    "push_publish_state_comment",
    "push_sysadmin_taken_comment",
    "sync_repair_request_to_tracker",
    "tracker_comment_status_from_site",
    "tracker_comment_status_sync",
    "upload_issue_attachment",
    "yfm_red",
]


def sync_repair_request_to_tracker(repair_request: RepairRequest) -> TrackerIssueResult:
    return get_tracker_issue_service().sync_repair_request(repair_request)


def list_issue_attachments(
    repair_request: RepairRequest,
) -> list[TrackerAttachmentMeta]:
    return get_tracker_issue_service().list_attachments(repair_request)


def upload_issue_attachment(
    issue_ref: str,
    *,
    file_path: Path,
    filename: str,
) -> TrackerAttachmentMeta:
    return get_tracker_issue_service().upload_attachment(
        issue_ref,
        file_path=file_path,
        filename=filename,
    )


def fetch_attachment_content(
    repair_request: RepairRequest,
    attachment_id: str,
    *,
    variant: str = "content",
) -> tuple[bytes, str | None]:
    return get_tracker_issue_service().fetch_attachment_content(
        repair_request,
        attachment_id,
        variant=variant,
    )


def post_issue_comment(issue_ref: str, text: str, *, markup_md: bool = True) -> None:
    get_tracker_issue_service().post_comment(issue_ref, text, markup_md=markup_md)


def push_issue_status_from_site(
    issue_ref: str,
    target_status_label: str,
    *,
    resolution: str | None = None,
) -> None:
    get_tracker_issue_service().push_status_from_site(
        issue_ref,
        target_status_label,
        resolution=resolution,
    )


def post_site_user_comment(issue_ref: str, user: User, body: str) -> None:
    get_tracker_issue_service().post_site_user_comment(issue_ref, user, body)


def push_publish_state_comment(issue_ref: str, is_published: bool) -> None:
    get_tracker_issue_service().push_publish_state_comment(issue_ref, is_published)


def push_sysadmin_taken_comment(issue_ref: str, *, taken: bool) -> None:
    get_tracker_issue_service().push_sysadmin_taken_comment(issue_ref, taken=taken)
