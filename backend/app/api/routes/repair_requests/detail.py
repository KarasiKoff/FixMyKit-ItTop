from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.api.deps import get_db, require_admin_or_sysadmin
from backend.app.models.user import User
from backend.app.repositories.repair_request_repository import (
    load_repair_request_detail,
)
from backend.app.schemas.repair_request import (
    RepairRequestClose,
    RepairRequestDetail,
    RepairRequestPublish,
    RepairRequestStatusUpdate,
    RepairRequestTake,
    RepairRequestWorkflowUpdate,
)
from backend.app.services.repair_request_actions_service import (
    close_request,
    update_publish,
    update_status,
    update_take,
    update_workflow,
)

router = APIRouter()


@router.get("/repair-requests/{request_id}", response_model=RepairRequestDetail)
def get_repair_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_sysadmin),
) -> RepairRequestDetail:
    return load_repair_request_detail(db, request_id)


@router.patch(
    "/repair-requests/{request_id}/workflow", response_model=RepairRequestDetail
)
def update_repair_request_workflow(
    request_id: UUID,
    payload: RepairRequestWorkflowUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_sysadmin),
) -> RepairRequestDetail:
    return update_workflow(db, request_id, current_user, payload)


@router.patch(
    "/repair-requests/{request_id}/status", response_model=RepairRequestDetail
)
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


@router.patch(
    "/repair-requests/{request_id}/publish", response_model=RepairRequestDetail
)
def publish_repair_request(
    request_id: UUID,
    payload: RepairRequestPublish,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_sysadmin),
) -> RepairRequestDetail:
    return update_publish(db, request_id, payload)
