from datetime import datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from backend.app.api.deps import get_db, require_admin_or_sysadmin
from backend.app.models.enums import RequestStatus
from backend.app.models.user import User
from backend.app.schemas.repair_request import (
    PublicRepairRequestResponse,
    RepairRequestClose,
    RepairRequestDetail,
    RepairRequestList,
    RepairRequestPublish,
    RepairRequestResponse,
    RepairRequestStatusUpdate,
    RepairRequestTake,
    RepairRequestWorkflowUpdate,
)
from backend.app.schemas.suggest import SuggestResponse
from backend.app.schemas.attachments import TrackerAttachmentList
from backend.app.schemas.repair_request_comment import (
    RepairRequestCommentCreate,
    RepairRequestCommentList,
    RepairRequestCommentResponse,
)
from backend.app.schemas.tracker import TrackerBulkSyncResponse, TrackerSyncResponse
from backend.app.services.repair_request_actions_service import (
    close_request,
    push_status_to_tracker,
    update_publish,
    update_status,
    update_take,
    update_workflow,
)
from backend.app.services.repair_request_attachments_service import (
    fetch_tracker_attachment_bytes,
    list_tracker_attachments,
)
from backend.app.services.repair_request_comments_route_service import (
    create_repair_request_comment,
    list_repair_request_comments,
)
from backend.app.services.repair_request_create_service import (
    create_public_repair_request as create_public_repair_request_svc,
    create_staff_repair_request,
    parse_public_create_request,
    parse_staff_create_request,
    public_create_response,
)
from backend.app.queries.repair_request_list_query import (
    RepairRequestSortBy,
    fetch_repair_requests_page,
    suggest_repair_requests,
)
from backend.app.services.repair_request_presenters import repair_request_to_list_response
from backend.app.repositories.repair_request_repository import (
    get_repair_request_or_404,
    load_repair_request_detail,
)
from backend.app.services.repair_request_tracker_bulk_service import sync_unsynchronized_repair_requests
from backend.app.services.repair_request_tracker_route_service import sync_repair_request_with_tracker

router = APIRouter(prefix="/api", tags=["repair-requests"])

_REPAIR_REQUEST_SORT_FIELDS: set[str] = {
    "created_at",
    "device_inventory_number",
    "applicant_name",
    "status",
}
_REPAIR_REQUEST_SUGGEST_FIELDS: set[str] = {"device", "applicant"}


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
    sort_by: RepairRequestSortBy = Query(default="created_at"),
    sort_dir: Literal["asc", "desc"] = Query(default="desc"),
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_sysadmin),
) -> RepairRequestList:
    if sort_by not in _REPAIR_REQUEST_SORT_FIELDS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_sort_by")

    items, total = fetch_repair_requests_page(
        db,
        device=device,
        applicant=applicant,
        status=status_filter,
        device_id=device_id,
        author_user_id=author_user_id,
        date_from=date_from,
        date_to=date_to,
        sort_by=sort_by,
        sort_dir=sort_dir,
        limit=limit,
        offset=offset,
    )
    return RepairRequestList(
        items=[repair_request_to_list_response(item) for item in items],
        total=total,
    )


@router.post(
    "/repair-requests/tracker/sync-unsynchronized",
    response_model=TrackerBulkSyncResponse,
    status_code=status.HTTP_200_OK,
)
def sync_unsynchronized_repair_requests_route(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_sysadmin),
) -> TrackerBulkSyncResponse:
    return sync_unsynchronized_repair_requests(db)


@router.post("/repair-requests", response_model=RepairRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_repair_request(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_sysadmin),
) -> RepairRequestResponse:
    fields, uploads = await parse_staff_create_request(request, current_user)
    repair_request = await create_staff_repair_request(db, fields, uploads)
    return repair_request_to_list_response(repair_request)


@router.post("/public/repair-requests", response_model=PublicRepairRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_public_repair_request(
    request: Request,
    db: Session = Depends(get_db),
) -> PublicRepairRequestResponse:
    fields, uploads = await parse_public_create_request(request)
    repair_request = await create_public_repair_request_svc(db, fields, uploads)
    return public_create_response(repair_request)


@router.get("/repair-requests/{request_id}", response_model=RepairRequestDetail)
def get_repair_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_sysadmin),
) -> RepairRequestDetail:
    return load_repair_request_detail(db, request_id)


@router.get("/repair-requests/{request_id}/comments", response_model=RepairRequestCommentList)
def get_repair_request_comments(
    request_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_sysadmin),
) -> RepairRequestCommentList:
    return list_repair_request_comments(db, request_id)


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
    return create_repair_request_comment(db, request_id, current_user, payload)


@router.patch("/repair-requests/{request_id}/workflow", response_model=RepairRequestDetail)
def update_repair_request_workflow(
    request_id: UUID,
    payload: RepairRequestWorkflowUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_sysadmin),
) -> RepairRequestDetail:
    return update_workflow(db, request_id, current_user, payload)


@router.patch("/repair-requests/{request_id}/status", response_model=RepairRequestDetail)
def update_repair_request_status(
    request_id: UUID,
    payload: RepairRequestStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_sysadmin),
) -> RepairRequestDetail:
    return update_status(db, request_id, current_user, payload)


@router.patch("/repair-requests/{request_id}/take", response_model=RepairRequestDetail)
def take_repair_request(
    request_id: UUID,
    payload: RepairRequestTake,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_sysadmin),
) -> RepairRequestDetail:
    return update_take(db, request_id, current_user, payload)


@router.patch("/repair-requests/{request_id}/close", response_model=RepairRequestDetail)
def close_repair_request(
    request_id: UUID,
    payload: RepairRequestClose,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_sysadmin),
) -> RepairRequestDetail:
    return close_request(db, request_id, current_user, payload)


@router.patch("/repair-requests/{request_id}/publish", response_model=RepairRequestDetail)
def publish_repair_request(
    request_id: UUID,
    payload: RepairRequestPublish,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_sysadmin),
) -> RepairRequestDetail:
    return update_publish(db, request_id, payload)


@router.post("/repair-requests/{request_id}/tracker/push-status", response_model=RepairRequestDetail)
def push_repair_request_status_to_tracker(
    request_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_sysadmin),
) -> RepairRequestDetail:
    return push_status_to_tracker(db, request_id)


@router.post("/repair-requests/{request_id}/tracker/sync", response_model=TrackerSyncResponse)
def sync_repair_request_tracker(
    request_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_sysadmin),
) -> TrackerSyncResponse:
    return sync_repair_request_with_tracker(db, request_id)


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
