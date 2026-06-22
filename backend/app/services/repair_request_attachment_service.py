"""Вложения заявок: диск - Tracker, статусы, очистка."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import timedelta
from uuid import UUID

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session


from backend.app.core.config import settings
from backend.app.models.enums import AttachmentsSyncStatus
from backend.app.models.repair_request import RepairRequest
from backend.app.repositories.repair_request_repository import RepairRequestRepository
from backend.app.services.attachment_storage import (
    PendingAttachment,
    cleanup_directory,
    count_pending,
    delete_pending_file,
    delete_stale_pending_files,
    iter_pending_request_dirs,
    list_pending,
    remove_pending_dir,
    save_pending_file,
)
from backend.app.services.attachment_validation import (
    attachment_kind,
    effective_max_attachment_bytes,
    is_allowed_attachment,
)
from backend.app.integrations.registry import external_tracker_enabled, get_issue_tracker
from backend.app.integrations.types import IssueTrackerUnavailableError
from backend.app.services.tracker_types import issue_ref_for

TrackerUnavailableError = IssueTrackerUnavailableError

logger = logging.getLogger(__name__)


class AttachmentLimitError(Exception):
    pass


class AttachmentValidationError(Exception):
    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


@dataclass(frozen=True)
class AttachmentCleanupResult:
    orphan_dirs_removed: int
    stale_files_removed: int
    empty_dirs_removed: int


@dataclass(frozen=True)
class PendingSyncResult:
    uploaded: list[PendingAttachment]
    ok: int
    failed: int


def max_per_request() -> int:
    return settings.server.attachment_max_per_request


def max_bytes() -> int:
    return effective_max_attachment_bytes()


def recompute_attachment_fields(repair_request: RepairRequest) -> None:
    pending = count_pending(repair_request.id)
    synced = int(repair_request.attachments_synced_count or 0)
    total = pending + synced
    repair_request.attachments_count = total
    repair_request.has_attachments = total > 0
    if not repair_request.has_attachments:
        repair_request.attachments_sync_status = AttachmentsSyncStatus.NONE
        return
    if pending > 0:
        repair_request.attachments_sync_status = AttachmentsSyncStatus.PARTIAL
    elif synced > 0:
        repair_request.attachments_sync_status = AttachmentsSyncStatus.COMPLETE
    else:
        repair_request.attachments_sync_status = AttachmentsSyncStatus.NONE


async def read_upload_limited(upload: UploadFile) -> bytes:
    max_size = max_bytes()
    chunks: list[bytes] = []
    total = 0
    while True:
        block = await upload.read(1024 * 1024)
        if not block:
            break
        total += len(block)
        if total > max_size:
            raise AttachmentValidationError("attachment_too_large")
        chunks.append(block)
    return b"".join(chunks)


async def validate_and_store_uploads(
    repair_request: RepairRequest,
    uploads: list[UploadFile],
) -> list[PendingAttachment]:
    if not uploads:
        return []
    pending_now = count_pending(repair_request.id)
    synced = int(repair_request.attachments_synced_count or 0)
    if pending_now + synced + len(uploads) > max_per_request():
        raise AttachmentLimitError("attachment_limit_reached")

    stored: list[PendingAttachment] = []
    for upload in uploads:
        name = upload.filename or "file"
        if not is_allowed_attachment(name, upload.content_type):
            raise AttachmentValidationError("attachment_type_not_allowed")
        data = await read_upload_limited(upload)
        if len(data) > max_bytes():
            raise AttachmentValidationError("attachment_too_large")
        item = save_pending_file(
            repair_request.id,
            original_name=name,
            data=data,
            mimetype=upload.content_type,
        )
        stored.append(item)

    repair_request.attachments_synced_count = synced
    recompute_attachment_fields(repair_request)
    return stored


def finalize_pending_deletions(
    uploaded: list[PendingAttachment], request_id: UUID
) -> None:
    """Удаляет с диска только после успешного commit в БД."""
    for item in uploaded:
        delete_pending_file(item.path)
    if count_pending(request_id) == 0:
        remove_pending_dir(request_id)


def sync_pending_attachments_to_tracker(
    repair_request: RepairRequest,
    *,
    remove_from_disk: bool = False,
) -> PendingSyncResult:
    """Загружает pending-файлы в Tracker. Файлы с диска удаляются только при remove_from_disk=True."""
    ref = issue_ref_for(repair_request)
    if not ref:
        pending_left = count_pending(repair_request.id)
        return PendingSyncResult(uploaded=[], ok=0, failed=pending_left)

    ok = 0
    failed = 0
    uploaded: list[PendingAttachment] = []
    for item in list_pending(repair_request.id):
        try:
            get_issue_tracker().upload_attachment(
                repair_request,
                file_path=str(item.path),
                filename=item.original_name,
            )
        except IssueTrackerUnavailableError as exc:
            failed += 1
            logger.warning(
                "tracker_attachment_upload_failed request_id=%s file=%s error=%s",
                repair_request.id,
                item.original_name,
                exc,
            )
            continue
        repair_request.attachments_synced_count = (
            int(repair_request.attachments_synced_count or 0) + 1
        )
        uploaded.append(item)
        ok += 1

    if remove_from_disk:
        finalize_pending_deletions(uploaded, repair_request.id)
        recompute_attachment_fields(repair_request)
    return PendingSyncResult(uploaded=uploaded, ok=ok, failed=failed)


def apply_attachment_state_after_sync(
    repair_request: RepairRequest,
    uploaded: list[PendingAttachment],
) -> None:
    """Удаляет загруженные файлы с диска и пересчитывает счётчики (после commit тикета)."""
    finalize_pending_deletions(uploaded, repair_request.id)
    recompute_attachment_fields(repair_request)


def refresh_attachment_fields_from_disk(repair_request: RepairRequest) -> None:
    """Пересчёт по фактическому числу файлов на диске (чинит устаревшие значения в БД)."""
    recompute_attachment_fields(repair_request)


def sync_external_issue_and_attachments(
    db: Session, repair_request: RepairRequest
) -> bool:
    """Создаёт/подтверждает задачу во внешнем трекере и догружает pending-вложения."""
    tracker = get_issue_tracker()
    if not tracker.is_configured():
        logger.warning(
            "external_sync_skipped_not_configured request_id=%s",
            repair_request.id,
        )
        return False
    try:
        result = tracker.sync_repair_request(repair_request)
    except IssueTrackerUnavailableError as exc:
        logger.error(
            "external_sync_failed request_id=%s error=%s",
            repair_request.id,
            exc.message,
        )
        return False

    repair_request.tracker_ticket_id = result.ticket_id
    repair_request.tracker_ticket_key = result.ticket_key
    repair_request.tracker_ticket_url = result.ticket_url
    repair_request.last_sync_at = result.synced_at
    db.flush()
    db.commit()

    pending_before = count_pending(repair_request.id)
    attachments_ok = True
    if pending_before > 0:
        sync_result = sync_pending_attachments_to_tracker(
            repair_request, remove_from_disk=False
        )
        apply_attachment_state_after_sync(repair_request, sync_result.uploaded)
        attachments_ok = sync_result.ok > 0 and sync_result.failed == 0
    else:
        refresh_attachment_fields_from_disk(repair_request)
    db.commit()
    db.refresh(repair_request)
    if pending_before > 0 and not attachments_ok:
        return False
    return True


def sync_tracker_issue_and_attachments(
    db: Session, repair_request: RepairRequest
) -> bool:
    """Обратная совместимость."""
    return sync_external_issue_and_attachments(db, repair_request)


def run_attachment_cleanup(db: Session) -> AttachmentCleanupResult:
    max_age = timedelta(days=settings.server.attachment_orphan_max_age_days)
    valid_ids = RepairRequestRepository(db).all_ids()

    orphan_dirs = 0
    stale_files = 0
    empty_dirs = 0

    for rid, path in iter_pending_request_dirs():
        if rid is None:
            cleanup_directory(path)
            orphan_dirs += 1
            continue
        if rid not in valid_ids:
            cleanup_directory(path)
            orphan_dirs += 1
            continue
        stale_files += delete_stale_pending_files(rid, max_age=max_age)
        if count_pending(rid) == 0:
            remove_pending_dir(rid)
            empty_dirs += 1
            rr = RepairRequestRepository(db).get_optional(rid)
            if rr is not None:
                recompute_attachment_fields(rr)

    db.commit()
    return AttachmentCleanupResult(
        orphan_dirs_removed=orphan_dirs,
        stale_files_removed=stale_files,
        empty_dirs_removed=empty_dirs,
    )


def tracker_attachment_kind(meta_mimetype: str | None, name: str) -> str:
    return attachment_kind(name, meta_mimetype)


def http_error_from_attachment_exc(exc: Exception) -> HTTPException:
    if isinstance(exc, AttachmentLimitError):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="attachment_limit_reached",
        )
    if isinstance(exc, AttachmentValidationError):
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.code)
    if isinstance(exc, TrackerUnavailableError):
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="tracker_unavailable"
        )
    raise exc
