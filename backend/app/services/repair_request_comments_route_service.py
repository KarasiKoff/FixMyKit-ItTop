"""HTTP-слой комментариев к заявке (список и создание)."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from backend.app.models.user import User
from backend.app.schemas.repair_request_comment import (
    RepairRequestCommentCreate,
    RepairRequestCommentList,
    RepairRequestCommentResponse,
)
from backend.app.services.realtime_notify import notify_repair_request_updated
from backend.app.services.repair_request_comment_service import (
    create_comment,
    list_comments,
)
from backend.app.repositories.repair_request_repository import get_repair_request_or_404


def list_repair_request_comments(
    db: Session, request_id: UUID
) -> RepairRequestCommentList:
    get_repair_request_or_404(db, request_id)
    return RepairRequestCommentList(items=list_comments(db, request_id))


def create_repair_request_comment(
    db: Session,
    request_id: UUID,
    current_user: User,
    payload: RepairRequestCommentCreate,
) -> RepairRequestCommentResponse:
    repair_request = get_repair_request_or_404(db, request_id)
    item = create_comment(db, repair_request, current_user, payload.body)
    notify_repair_request_updated(repair_request, source="api")
    return item
