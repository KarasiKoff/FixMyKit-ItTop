from datetime import datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.api.deps import get_db, require_admin_or_sysadmin
from backend.app.api.routes.repair_requests._constants import (
    REPAIR_REQUEST_SORT_FIELDS,
    REPAIR_REQUEST_SUGGEST_FIELDS,
)
from backend.app.models.enums import RequestStatus
from backend.app.models.user import User
from backend.app.queries.repair_request_list_query import (
    RepairRequestSortBy,
    fetch_repair_requests_page,
    suggest_repair_requests,
)
from backend.app.schemas.repair_request import RepairRequestList
from backend.app.schemas.suggest import SuggestResponse
from backend.app.schemas.tracker import TrackerBulkSyncResponse
from backend.app.services.repair_request_presenters import (
    repair_request_to_list_response,
)
from backend.app.services.repair_request_tracker_bulk_service import (
    sync_unsynchronized_repair_requests,
)

router = APIRouter()


@router.get("/repair-requests/suggest", response_model=SuggestResponse)
def repair_request_suggest(
    field: str = Query(...),
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_sysadmin),
) -> SuggestResponse:
    if field not in REPAIR_REQUEST_SUGGEST_FIELDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_suggest_field"
        )
    return SuggestResponse(items=suggest_repair_requests(db, field, q))


@router.get("/repair-requests", response_model=RepairRequestList)
def list_repair_requests(
    device: str | None = Query(
        default=None, description="Filter by device inventory number or name"
    ),
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
    _: User = Depends(require_admin_or_sysadmin),
) -> RepairRequestList:
    if sort_by not in REPAIR_REQUEST_SORT_FIELDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_sort_by"
        )

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
