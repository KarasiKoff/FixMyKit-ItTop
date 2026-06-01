"""Обслуживание: очистка временных вложений."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.api.deps import get_db, require_admin_or_sysadmin
from backend.app.models.user import User
from backend.app.schemas.attachments import AttachmentCleanupResponse
from backend.app.services.repair_request_attachment_service import run_attachment_cleanup

router = APIRouter(prefix="/api/admin", tags=["admin-maintenance"])


@router.post("/attachments/cleanup", response_model=AttachmentCleanupResponse)
def cleanup_stale_attachments(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_sysadmin),
) -> AttachmentCleanupResponse:
    result = run_attachment_cleanup(db)
    return AttachmentCleanupResponse(
        orphan_dirs_removed=result.orphan_dirs_removed,
        stale_files_removed=result.stale_files_removed,
        empty_dirs_removed=result.empty_dirs_removed,
    )
