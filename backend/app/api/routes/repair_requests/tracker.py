from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.api.deps import get_db, require_admin_or_sysadmin
from backend.app.models.user import User
from backend.app.schemas.repair_request import RepairRequestDetail
from backend.app.schemas.tracker import TrackerSyncResponse
from backend.app.services.repair_request_actions_service import push_status_to_tracker
from backend.app.services.repair_request_tracker_route_service import (
    sync_repair_request_with_tracker,
)

router = APIRouter()


@router.post(
    "/repair-requests/{request_id}/tracker/push-status",
    response_model=RepairRequestDetail,
)
def push_repair_request_status_to_tracker(
    request_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_sysadmin),
) -> RepairRequestDetail:
    return push_status_to_tracker(db, request_id)


@router.post(
    "/repair-requests/{request_id}/tracker/sync", response_model=TrackerSyncResponse
)
def sync_repair_request_tracker(
    request_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_sysadmin),
) -> TrackerSyncResponse:
    return sync_repair_request_with_tracker(db, request_id)
