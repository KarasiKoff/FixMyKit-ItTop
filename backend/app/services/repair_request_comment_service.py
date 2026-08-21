from uuid import UUID

from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.models.repair_request import RepairRequest
from backend.app.models.repair_request_comment import RepairRequestComment
from backend.app.models.user import User
from backend.app.repositories.repair_request_comment_repository import (
    RepairRequestCommentRepository,
)
from backend.app.schemas.repair_request_comment import RepairRequestCommentResponse
from backend.app.services.comment_body_normalize import (
    inbound_tracker_comment_display,
    legacy_markdown_author_to_plain,
    normalize_comment_body,
)
from backend.app.services.repair_request_tracker_outbound import (
    sync_user_comment_to_tracker,
)


def list_comments(
    db: Session, repair_request_id: UUID
) -> list[RepairRequestCommentResponse]:
    rows = RepairRequestCommentRepository(db).list_for_request(repair_request_id)
    return [_comment_response(row) for row in rows]


def create_comment(
    db: Session,
    repair_request: RepairRequest,
    author: User,
    body: str,
) -> RepairRequestCommentResponse:
    text = normalize_comment_body(body)
    sync_user_comment_to_tracker(repair_request, author, text)
    row = RepairRequestCommentRepository(db).create(
        repair_request_id=repair_request.id,
        author_user_id=author.id,
        body=text,
        tracker_synced=True,
    )
    loaded = RepairRequestCommentRepository(db).get_with_author(row.id)
    assert loaded is not None
    return _comment_response(loaded)


def _comment_response(row: RepairRequestComment) -> RepairRequestCommentResponse:
    author = row.author
    raw_body = legacy_markdown_author_to_plain(normalize_comment_body(row.body))
    webhook_login = (
        settings.server.tracker_webhook_actor_login or "tracker_webhook"
    ).strip() or "tracker_webhook"
    display_name, body = inbound_tracker_comment_display(
        author.login if author else None,
        author.full_name if author else None,
        raw_body,
        webhook_actor_login=webhook_login,
    )
    if not display_name and author:
        display_name = (author.full_name or "").strip() or author.login
    tracker_author_unlinked = bool(
        row.tracker_synced
        and author is not None
        and author.login == webhook_login
    )
    return RepairRequestCommentResponse(
        id=row.id,
        repair_request_id=row.repair_request_id,
        author_user_id=row.author_user_id,
        author_login=author.login if author else None,
        author_display_name=display_name,
        tracker_author_unlinked=tracker_author_unlinked,
        body=body,
        tracker_synced=row.tracker_synced,
        created_at=row.created_at,
    )
