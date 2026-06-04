"""Доступ к комментариям заявок в БД."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from backend.app.models.repair_request_comment import RepairRequestComment


class RepairRequestCommentRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def list_for_request(self, repair_request_id: UUID) -> list[RepairRequestComment]:
        return (
            self._db.query(RepairRequestComment)
            .options(joinedload(RepairRequestComment.author))
            .filter(RepairRequestComment.repair_request_id == repair_request_id)
            .order_by(RepairRequestComment.created_at.asc())
            .all()
        )

    def get_with_author(self, comment_id: UUID) -> RepairRequestComment | None:
        return (
            self._db.query(RepairRequestComment)
            .options(joinedload(RepairRequestComment.author))
            .filter(RepairRequestComment.id == comment_id)
            .first()
        )

    def find_by_tracker_comment_id(
        self,
        repair_request_id: UUID,
        tracker_comment_id: str,
    ) -> RepairRequestComment | None:
        return (
            self._db.query(RepairRequestComment)
            .filter(
                RepairRequestComment.repair_request_id == repair_request_id,
                RepairRequestComment.tracker_comment_id == tracker_comment_id,
            )
            .first()
        )

    def create(
        self,
        *,
        repair_request_id: UUID,
        author_user_id: UUID,
        body: str,
        tracker_synced: bool = False,
        tracker_comment_id: str | None = None,
    ) -> RepairRequestComment:
        row = RepairRequestComment(
            repair_request_id=repair_request_id,
            author_user_id=author_user_id,
            body=body,
            tracker_synced=tracker_synced,
            tracker_comment_id=tracker_comment_id,
        )
        self._db.add(row)
        self._db.commit()
        self._db.refresh(row)
        return row
