import asyncio
from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session, joinedload
from starlette.datastructures import UploadFile as StarletteUploadFile

from backend.app.api.deps import get_db, require_admin_or_sysadmin
from backend.app.models.device import Device
from backend.app.models.enums import RepairStatus, RequestStatus
from backend.app.models.repair_request import RepairRequest
from backend.app.models.user import User
from backend.app.schemas.repair_request import (
    PublicRepairRequestCreate,
    PublicRepairRequestResponse,
    RepairRequestClose,
    RepairRequestCreate,
    RepairRequestDetail,
    RepairRequestList,
    RepairRequestPublish,
    RepairRequestResponse,
    RepairRequestStatusUpdate,
    RepairRequestTake,
    RepairRequestWorkflowUpdate,
)
from backend.app.schemas.suggest import SuggestResponse
from backend.app.schemas.attachments import TrackerAttachmentItem, TrackerAttachmentList
from backend.app.schemas.repair_request_comment import (
    RepairRequestCommentCreate,
    RepairRequestCommentList,
    RepairRequestCommentResponse,
)
from backend.app.schemas.tracker import TrackerBulkSyncResponse, TrackerSyncResponse
from backend.app.services.repair_history_service import add_repair_history
from backend.app.services.repair_request_comment_service import create_comment, list_comments
from backend.app.services.repair_request_tracker_outbound import (
    REQUEST_STATUS_TRACKER_LABEL,
    RESOLUTION_NOTE_TO_TRACKER_KEY,
    require_tracker_ticket,
    retry_pending_status_sync,
    sync_publish_to_tracker,
    sync_resolution_comment_to_tracker,
    sync_status_to_tracker,
    sync_sysadmin_taken_to_tracker,
)
from backend.app.services.repair_request_workflow_service import apply_workflow_change
from backend.app.services.realtime_notify import notify_repair_request_updated
from backend.app.services.repair_request_attachment_service import (
    AttachmentLimitError,
    AttachmentValidationError,
    http_error_from_attachment_exc,
    recompute_attachment_fields,
    refresh_attachment_fields_from_disk,
    sync_tracker_issue_and_attachments,
    tracker_attachment_kind,
    validate_and_store_uploads,
)
from backend.app.services.repair_request_closure_service import record_repair_request_closed
from backend.app.services.repair_request_sysadmin_taken_service import clear_sysadmin_taken_fields
from backend.app.services.repair_request_list_query import fetch_repair_requests_page, suggest_repair_requests
from backend.app.services.repair_request_target import (
    ensure_no_active_request,
    ensure_target_exists,
    parse_repair_target,
)
from backend.app.services.tracker_service import (
    TrackerUnavailableError,
    fetch_attachment_content,
    issue_ref_for,
    list_issue_attachments,
)

router = APIRouter(prefix="/api", tags=["repair-requests"])

_REPAIR_REQUEST_SORT_FIELDS: set[str] = {
    "created_at",
    "device_inventory_number",
    "applicant_name",
    "status",
}
_REPAIR_REQUEST_SUGGEST_FIELDS: set[str] = {"device", "applicant"}

ACTIVE_STATUSES = (
    RequestStatus.OPEN,
    RequestStatus.IN_PROGRESS,
    RequestStatus.NEEDS_INFO,
)
ALLOWED_STATUS_TRANSITIONS = {
    RequestStatus.OPEN: {
        RequestStatus.OPEN,
        RequestStatus.IN_PROGRESS,
        RequestStatus.NEEDS_INFO,
        RequestStatus.CLOSED,
    },
    RequestStatus.IN_PROGRESS: {
        RequestStatus.IN_PROGRESS,
        RequestStatus.NEEDS_INFO,
        RequestStatus.CLOSED,
    },
    RequestStatus.NEEDS_INFO: {
        RequestStatus.NEEDS_INFO,
        RequestStatus.IN_PROGRESS,
        RequestStatus.CLOSED,
    },
    RequestStatus.CLOSED: {RequestStatus.CLOSED},
}


def get_repair_request_or_404(db: Session, request_id: UUID, *, for_tracker: bool = False) -> RepairRequest:
    q = db.query(RepairRequest).filter(RepairRequest.id == request_id)
    if for_tracker:
        q = q.options(
            joinedload(RepairRequest.device).joinedload(Device.audience),
            joinedload(RepairRequest.audience),
            joinedload(RepairRequest.author),
        )
    repair_request = q.first()
    if repair_request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="repair_request_not_found")
    return repair_request


def _try_tracker_sync(db: Session, request_id: UUID) -> bool:
    """Пытается создать/подтянуть задачу в Tracker и догрузить вложения."""
    repair_request = get_repair_request_or_404(db, request_id, for_tracker=True)
    return sync_tracker_issue_and_attachments(db, repair_request)


def _collect_upload_files(form) -> list[UploadFile]:
    files: list[UploadFile] = []
    for key in ("files", "file"):
        for item in form.getlist(key):
            if isinstance(item, StarletteUploadFile) and item.filename:
                files.append(item)
    return files


async def _parse_multipart_create(request: Request) -> tuple[dict, list[UploadFile]]:
    form = await request.form()
    device_raw = form.get("device_id")
    audience_raw = form.get("audience_id")
    device_id = UUID(str(device_raw)) if device_raw is not None else None
    audience_id = UUID(str(audience_raw)) if audience_raw is not None else None
    device_id, audience_id = parse_repair_target(device_id=device_id, audience_id=audience_id)
    description = str(form.get("description") or "").strip()
    if not description:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="description_required")
    applicant = form.get("applicant_name")
    applicant_name = str(applicant).strip() if applicant is not None else None
    sync_raw = form.get("sync_to_tracker")
    sync_to_tracker = True
    if sync_raw is not None:
        sync_to_tracker = str(sync_raw).lower() in ("1", "true", "yes", "on")
    return {
        "device_id": device_id,
        "audience_id": audience_id,
        "description": description,
        "applicant_name": applicant_name,
        "sync_to_tracker": sync_to_tracker,
    }, _collect_upload_files(form)


async def _parse_public_multipart_create(request: Request) -> tuple[dict, list[UploadFile]]:
    form = await request.form()
    device_raw = form.get("device_id")
    audience_raw = form.get("audience_id")
    device_id = UUID(str(device_raw)) if device_raw is not None else None
    audience_id = UUID(str(audience_raw)) if audience_raw is not None else None
    device_id, audience_id = parse_repair_target(device_id=device_id, audience_id=audience_id)
    applicant_raw = form.get("applicant_name")
    if applicant_raw is None or not str(applicant_raw).strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="applicant_name_required")
    description = str(form.get("description") or "").strip()
    if not description:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="description_required")
    return {
        "device_id": device_id,
        "audience_id": audience_id,
        "applicant_name": str(applicant_raw).strip(),
        "description": description,
    }, _collect_upload_files(form)


async def _store_uploads_safe(
    db: Session,
    repair_request: RepairRequest,
    uploads: list[UploadFile],
) -> None:
    if not uploads:
        return
    try:
        await validate_and_store_uploads(repair_request, uploads)
        db.commit()
    except (AttachmentLimitError, AttachmentValidationError) as exc:
        db.rollback()
        raise http_error_from_attachment_exc(exc) from exc


def _record_request_created(db: Session, repair_request: RepairRequest) -> None:
    device = db.query(Device).filter(Device.id == repair_request.device_id).first()
    if device is None:
        return
    old_rs = device.repair_status
    device.repair_status = RepairStatus.IN_REPAIR
    add_repair_history(
        db,
        device_id=device.id,
        repair_request_id=repair_request.id,
        old_status=old_rs,
        new_status=RepairStatus.IN_REPAIR,
        note="Создана заявка на ремонт",
    )


@router.get("/repair-requests/suggest", response_model=SuggestResponse)
def repair_request_suggest(
    field: str = Query(...),
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_sysadmin),
) -> SuggestResponse:
    if field not in _REPAIR_REQUEST_SUGGEST_FIELDS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_suggest_field")
    return SuggestResponse(items=suggest_repair_requests(db, field, q))


@router.get("/repair-requests", response_model=RepairRequestList)
def list_repair_requests(
    device: str | None = Query(default=None, description="Filter by device inventory number or name"),
    applicant: str | None = Query(default=None, description="Filter by applicant name"),
    status_filter: RequestStatus | None = Query(default=None, alias="status"),
    device_id: UUID | None = None,
    author_user_id: UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_by: str = Query(default="created_at"),
    sort_dir: Literal["asc", "desc"] = Query(default="desc"),
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_sysadmin),
) -> RepairRequestList:
    if sort_by not in _REPAIR_REQUEST_SORT_FIELDS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_sort_by")

    _ = device_id, author_user_id, date_from, date_to, current_user

    items, total = fetch_repair_requests_page(
        db,
        device=device,
        applicant=applicant,
        status=status_filter,
        sort_by=sort_by,  # type: ignore[arg-type]
        sort_dir=sort_dir,
        limit=limit,
        offset=offset,
    )
    return RepairRequestList(items=[_repair_request_list_item(item) for item in items], total=total)


def _repair_request_list_item(item: RepairRequest) -> RepairRequestResponse:
    payload = RepairRequestResponse.model_validate(item)
    updates: dict = {}
    if item.device is not None:
        updates["device_inventory_number"] = item.device.inventory_number
        updates["device_name"] = item.device.name
    if item.audience is not None:
        updates["audience_name"] = item.audience.name
    if not updates:
        return payload
    return payload.model_copy(update=updates)


@router.post(
    "/repair-requests/tracker/sync-unsynchronized",
    response_model=TrackerBulkSyncResponse,
    status_code=status.HTTP_200_OK,
)
def sync_unsynchronized_repair_requests(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_sysadmin),
) -> TrackerBulkSyncResponse:
    """Синхронизирует с Tracker все заявки без ticket id и key."""
    rows = (
        db.query(RepairRequest.id)
        .filter(
            and_(
                or_(RepairRequest.tracker_ticket_id.is_(None), RepairRequest.tracker_ticket_id == ""),
                or_(RepairRequest.tracker_ticket_key.is_(None), RepairRequest.tracker_ticket_key == ""),
            )
        )
        .order_by(RepairRequest.created_at.asc())
        .all()
    )
    attempted = len(rows)
    synced = 0
    failed = 0
    for (rid,) in rows:
        if _try_tracker_sync(db, rid):
            synced += 1
        else:
            failed += 1
    return TrackerBulkSyncResponse(attempted=attempted, synced=synced, failed=failed)


@router.post("/repair-requests", response_model=RepairRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_repair_request(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_sysadmin),
) -> RepairRequestResponse:
    content_type = (request.headers.get("content-type") or "").lower()
    if "multipart/form-data" in content_type:
        fields, uploads = await _parse_multipart_create(request)
        device_id = fields["device_id"]
        audience_id = fields["audience_id"]
        description = fields["description"]
        applicant_name = fields["applicant_name"]
        sync_to_tracker = fields["sync_to_tracker"]
        author_user_id = current_user.id
    else:
        try:
            body = await request.json()
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_json") from exc
        payload = RepairRequestCreate.model_validate(body)
        device_id = payload.device_id
        audience_id = payload.audience_id
        description = payload.description
        applicant_name = payload.applicant_name
        sync_to_tracker = payload.sync_to_tracker
        author_user_id = payload.author_user_id or current_user.id
        uploads = []

    ensure_target_exists(db, device_id, audience_id)
    ensure_no_active_request(db, device_id=device_id, audience_id=audience_id)

    repair_request = RepairRequest(
        device_id=device_id,
        audience_id=audience_id,
        description=description,
        applicant_name=applicant_name,
        author_user_id=author_user_id,
    )
    db.add(repair_request)
    db.flush()
    _record_request_created(db, repair_request)
    db.commit()
    db.refresh(repair_request)

    await _store_uploads_safe(db, repair_request, uploads)
    db.refresh(repair_request)
    notify_repair_request_updated(repair_request, source="api")

    if sync_to_tracker:
        await asyncio.to_thread(_try_tracker_sync, db, repair_request.id)
    elif uploads and issue_ref_for(repair_request) is None:
        recompute_attachment_fields(repair_request)
        db.commit()
    db.refresh(repair_request)
    return _repair_request_list_item(repair_request)


@router.post("/public/repair-requests", response_model=PublicRepairRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_public_repair_request(
    request: Request,
    db: Session = Depends(get_db),
) -> PublicRepairRequestResponse:
    content_type = (request.headers.get("content-type") or "").lower()
    if "multipart/form-data" in content_type:
        fields, uploads = await _parse_public_multipart_create(request)
        device_id = fields["device_id"]
        audience_id = fields["audience_id"]
        applicant_name = fields["applicant_name"]
        description = fields["description"]
    else:
        try:
            body = await request.json()
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_json") from exc
        payload = PublicRepairRequestCreate.model_validate(body)
        device_id = payload.device_id
        audience_id = payload.audience_id
        applicant_name = payload.applicant_name
        description = payload.description
        uploads = []

    ensure_target_exists(db, device_id, audience_id)
    ensure_no_active_request(db, device_id=device_id, audience_id=audience_id)

    repair_request = RepairRequest(
        device_id=device_id,
        audience_id=audience_id,
        applicant_name=applicant_name,
        description=description,
    )
    db.add(repair_request)
    db.flush()
    _record_request_created(db, repair_request)
    db.commit()
    db.refresh(repair_request)

    await _store_uploads_safe(db, repair_request, uploads)
    db.refresh(repair_request)

    await asyncio.to_thread(_try_tracker_sync, db, repair_request.id)
    db.refresh(repair_request)
    notify_repair_request_updated(repair_request, source="public_api")
    return PublicRepairRequestResponse(
        id=repair_request.id,
        status=repair_request.status,
        has_attachments=repair_request.has_attachments,
        attachments_sync_status=repair_request.attachments_sync_status,
        attachments_count=repair_request.attachments_count,
        attachments_synced_count=repair_request.attachments_synced_count,
    )


@router.get("/repair-requests/{request_id}", response_model=RepairRequestDetail)
def get_repair_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_sysadmin),
) -> RepairRequestDetail:
    repair_request = (
        db.query(RepairRequest)
        .options(joinedload(RepairRequest.device), joinedload(RepairRequest.audience))
        .filter(RepairRequest.id == request_id)
        .first()
    )
    if repair_request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="repair_request_not_found")
    refresh_attachment_fields_from_disk(repair_request)
    db.commit()
    return _repair_request_list_item(repair_request)


@router.get("/repair-requests/{request_id}/comments", response_model=RepairRequestCommentList)
def get_repair_request_comments(
    request_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_sysadmin),
) -> RepairRequestCommentList:
    get_repair_request_or_404(db, request_id)
    return RepairRequestCommentList(items=list_comments(db, request_id))


@router.post(
    "/repair-requests/{request_id}/comments",
    response_model=RepairRequestCommentResponse,
    status_code=status.HTTP_201_CREATED,
)
def post_repair_request_comment(
    request_id: UUID,
    payload: RepairRequestCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_sysadmin),
) -> RepairRequestCommentResponse:
    repair_request = get_repair_request_or_404(db, request_id)
    item = create_comment(db, repair_request, current_user, payload.body)
    notify_repair_request_updated(repair_request, source="api")
    return item


@router.patch("/repair-requests/{request_id}/workflow", response_model=RepairRequestDetail)
def update_repair_request_workflow(
    request_id: UUID,
    payload: RepairRequestWorkflowUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_sysadmin),
) -> RepairRequestDetail:
    repair_request = get_repair_request_or_404(db, request_id)
    require_tracker_ticket(repair_request)
    apply_workflow_change(
        db,
        repair_request,
        current_user,
        payload.workflow,
        resolution=payload.resolution,
        comment=payload.comment,
    )
    db.refresh(repair_request)
    notify_repair_request_updated(repair_request, source="api")
    return RepairRequestDetail.model_validate(repair_request)


@router.patch("/repair-requests/{request_id}/status", response_model=RepairRequestDetail)
def update_repair_request_status(
    request_id: UUID,
    payload: RepairRequestStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_sysadmin),
) -> RepairRequestDetail:
    repair_request = get_repair_request_or_404(db, request_id)
    require_tracker_ticket(repair_request)
    if payload.status not in ALLOWED_STATUS_TRANSITIONS[repair_request.status]:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="invalid_status_transition")

    if payload.status == RequestStatus.CLOSED:
        record_repair_request_closed(
            db,
            repair_request,
            current_user,
            payload.resolution_note,
            payload.resolution_desc,
        )
    else:
        repair_request.status = payload.status
        repair_request.tracker_status_label = REQUEST_STATUS_TRACKER_LABEL[payload.status]
        if payload.resolution_note is not None:
            repair_request.resolution_note = payload.resolution_note
        if payload.resolution_desc is not None:
            repair_request.resolution_desc = payload.resolution_desc
        add_repair_history(
            db,
            device_id=repair_request.device_id,
            repair_request_id=repair_request.id,
            old_status=None,
            new_status=None,
            note=f"Статус заявки изменён: {payload.status.value}",
        )

    db.commit()
    db.refresh(repair_request)
    tracker_resolution = None
    if payload.status == RequestStatus.CLOSED and payload.resolution_note:
        tracker_resolution = RESOLUTION_NOTE_TO_TRACKER_KEY.get(payload.resolution_note.strip())
    sync_status_to_tracker(
        db,
        repair_request,
        payload.status,
        resolution=tracker_resolution,
    )
    if payload.status == RequestStatus.CLOSED:
        sync_resolution_comment_to_tracker(
            repair_request,
            payload.resolution_note,
            payload.resolution_desc,
        )
    notify_repair_request_updated(repair_request, source="api")
    return RepairRequestDetail.model_validate(repair_request)


@router.patch("/repair-requests/{request_id}/take", response_model=RepairRequestDetail)
def take_repair_request(
    request_id: UUID,
    payload: RepairRequestTake,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_sysadmin),
) -> RepairRequestDetail:
    repair_request = get_repair_request_or_404(db, request_id)
    require_tracker_ticket(repair_request)
    if payload.taken:
        repair_request.taken_by_sysadmin_at = datetime.now(timezone.utc)
        repair_request.taken_by_sysadmin_by_user_id = current_user.id
        add_repair_history(
            db,
            device_id=repair_request.device_id,
            repair_request_id=repair_request.id,
            old_status=None,
            new_status=None,
            note="Отмечено: забрал системный администратор",
        )
    else:
        clear_sysadmin_taken_fields(repair_request)
        add_repair_history(
            db,
            device_id=repair_request.device_id,
            repair_request_id=repair_request.id,
            old_status=None,
            new_status=None,
            note="Устройство возвращено на место",
        )

    db.commit()
    db.refresh(repair_request)
    sync_sysadmin_taken_to_tracker(repair_request, taken=payload.taken)
    notify_repair_request_updated(repair_request, source="api")
    return RepairRequestDetail.model_validate(repair_request)


@router.patch("/repair-requests/{request_id}/close", response_model=RepairRequestDetail)
def close_repair_request(
    request_id: UUID,
    payload: RepairRequestClose,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_sysadmin),
) -> RepairRequestDetail:
    repair_request = get_repair_request_or_404(db, request_id)
    require_tracker_ticket(repair_request)
    if RequestStatus.CLOSED not in ALLOWED_STATUS_TRANSITIONS[repair_request.status]:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="invalid_status_transition")

    record_repair_request_closed(
        db,
        repair_request,
        current_user,
        payload.resolution_note,
        payload.resolution_desc,
    )
    repair_request.tracker_status_label = REQUEST_STATUS_TRACKER_LABEL[RequestStatus.CLOSED]
    db.commit()
    db.refresh(repair_request)
    tracker_resolution = None
    if payload.resolution_note:
        tracker_resolution = RESOLUTION_NOTE_TO_TRACKER_KEY.get(payload.resolution_note.strip())
    sync_status_to_tracker(
        db,
        repair_request,
        RequestStatus.CLOSED,
        resolution=tracker_resolution,
    )
    sync_resolution_comment_to_tracker(
        repair_request,
        payload.resolution_note,
        payload.resolution_desc,
    )
    notify_repair_request_updated(repair_request, source="api")
    return RepairRequestDetail.model_validate(repair_request)


@router.patch("/repair-requests/{request_id}/publish", response_model=RepairRequestDetail)
def publish_repair_request(
    request_id: UUID,
    payload: RepairRequestPublish,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_sysadmin),
) -> RepairRequestDetail:
    repair_request = get_repair_request_or_404(db, request_id)
    require_tracker_ticket(repair_request)
    repair_request.is_published = payload.is_published
    db.commit()
    db.refresh(repair_request)
    sync_publish_to_tracker(repair_request, payload.is_published)
    notify_repair_request_updated(repair_request, source="api")
    return RepairRequestDetail.model_validate(repair_request)


@router.post("/repair-requests/{request_id}/tracker/push-status", response_model=RepairRequestDetail)
def push_repair_request_status_to_tracker(
    request_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_sysadmin),
) -> RepairRequestDetail:
    repair_request = get_repair_request_or_404(db, request_id)
    require_tracker_ticket(repair_request)
    if not repair_request.tracker_status_sync_pending:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="tracker_status_sync_not_pending",
        )
    retry_pending_status_sync(db, repair_request)
    db.refresh(repair_request)
    notify_repair_request_updated(repair_request, source="api")
    return RepairRequestDetail.model_validate(repair_request)


@router.post("/repair-requests/{request_id}/tracker/sync", response_model=TrackerSyncResponse)
def sync_repair_request_tracker(
    request_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_sysadmin),
) -> TrackerSyncResponse:
    repair_request = get_repair_request_or_404(db, request_id, for_tracker=True)
    if not sync_tracker_issue_and_attachments(db, repair_request):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="tracker_unavailable",
        ) from None
    db.refresh(repair_request)
    notify_repair_request_updated(repair_request, source="api")

    return TrackerSyncResponse(
        tracker_ticket_id=repair_request.tracker_ticket_id or "",
        tracker_ticket_key=repair_request.tracker_ticket_key or "",
        tracker_ticket_url=repair_request.tracker_ticket_url or "",
        last_sync_at=repair_request.last_sync_at or datetime.now(timezone.utc),
    )


@router.get(
    "/repair-requests/{request_id}/attachments",
    response_model=TrackerAttachmentList,
)
def list_repair_request_attachments(
    request_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_sysadmin),
) -> TrackerAttachmentList:
    repair_request = get_repair_request_or_404(db, request_id, for_tracker=True)
    if not issue_ref_for(repair_request):
        return TrackerAttachmentList(items=[])
    try:
        rows = list_issue_attachments(repair_request)
    except TrackerUnavailableError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="tracker_unavailable",
        ) from None
    items = [
        TrackerAttachmentItem(
            id=row.id,
            name=row.name,
            kind=tracker_attachment_kind(row.mimetype, row.name),
            mimetype=row.mimetype,
            size=row.size,
            has_thumbnail=bool(row.thumbnail_url),
            created_at=row.created_at,
        )
        for row in rows
    ]
    return TrackerAttachmentList(items=items)


@router.get("/repair-requests/{request_id}/attachments/{attachment_id}/content")
def get_repair_request_attachment_content(
    request_id: UUID,
    attachment_id: str,
    variant: Literal["content", "thumbnail"] = Query(default="content"),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_sysadmin),
) -> Response:
    repair_request = get_repair_request_or_404(db, request_id, for_tracker=True)
    try:
        data, content_type = fetch_attachment_content(
            repair_request,
            attachment_id,
            variant=variant,
        )
    except TrackerUnavailableError as exc:
        if "not_found" in exc.message:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="attachment_not_found") from None
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="tracker_unavailable",
        ) from None
    media = (content_type or "application/octet-stream").split(";")[0]
    return Response(content=data, media_type=media)
