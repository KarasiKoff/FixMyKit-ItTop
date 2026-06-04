from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from backend.app.api.deps import get_db, require_admin_or_sysadmin
from backend.app.models.user import User
from backend.app.schemas.attachments import TrackerAttachmentList
from backend.app.services.repair_request_attachments_service import (
    fetch_tracker_attachment_bytes,
    list_tracker_attachments,
)

router = APIRouter()


@router.get(
    "/repair-requests/{request_id}/attachments",
    response_model=TrackerAttachmentList,
)
def list_repair_request_attachments(
    request_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_sysadmin),
) -> TrackerAttachmentList:
    return list_tracker_attachments(db, request_id)


@router.get("/repair-requests/{request_id}/attachments/{attachment_id}/content")
def get_repair_request_attachment_content(
    request_id: UUID,
    attachment_id: str,
    variant: Literal["content", "thumbnail"] = Query(default="content"),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_sysadmin),
) -> Response:
    data, media_type = fetch_tracker_attachment_bytes(
        db,
        request_id,
        attachment_id,
        variant=variant,
    )
    return Response(content=data, media_type=media_type)
