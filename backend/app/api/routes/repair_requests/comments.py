from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from backend.app.api.deps import get_db, require_admin_or_sysadmin
from backend.app.models.user import User
from backend.app.schemas.repair_request_comment import (
    RepairRequestCommentCreate,
    RepairRequestCommentList,
    RepairRequestCommentResponse,
)
from backend.app.services.repair_request_comments_route_service import (
    create_repair_request_comment,
    list_repair_request_comments,
)

router = APIRouter()


@router.get(
    "/repair-requests/{request_id}/comments", response_model=RepairRequestCommentList
)
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
