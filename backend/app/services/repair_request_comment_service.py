from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from backend.app.models.repair_request import RepairRequest
from backend.app.models.repair_request_comment import RepairRequestComment
from backend.app.models.user import User
from backend.app.schemas.repair_request_comment import RepairRequestCommentResponse
from backend.app.services.repair_request_tracker_outbound import sync_user_comment_to_tracker


def list_comments(db: Session, repair_request_id: UUID) -> list[RepairRequestCommentResponse]:
    rows = (
        db.query(RepairRequestComment)
        .options(joinedload(RepairRequestComment.author))
        .filter(RepairRequestComment.repair_request_id == repair_request_id)
        .order_by(RepairRequestComment.created_at.asc())
        .all()
    )
    return [_comment_response(row) for row in rows]


def create_comment(
    db: Session,
    repair_request: RepairRequest,
    author: User,
    body: str,
) -> RepairRequestCommentResponse:
    text = body.strip()
    sync_user_comment_to_tracker(repair_request, author, text)
    row = RepairRequestComment(
        repair_request_id=repair_request.id,
        author_user_id=author.id,
        body=text,
        tracker_synced=True,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    row = (
        db.query(RepairRequestComment)
        .options(joinedload(RepairRequestComment.author))
        .filter(RepairRequestComment.id == row.id)
        .first()
    )
    assert row is not None
    return _comment_response(row)


def _comment_response(row: RepairRequestComment) -> RepairRequestCommentResponse:
    author = row.author
    return RepairRequestCommentResponse(
        id=row.id,
        repair_request_id=row.repair_request_id,
        author_user_id=row.author_user_id,
        author_login=author.login if author else None,
        author_display_name=(author.full_name if author else None) or (author.login if author else None),
        body=row.body,
        tracker_synced=row.tracker_synced,
        created_at=row.created_at,
    )
