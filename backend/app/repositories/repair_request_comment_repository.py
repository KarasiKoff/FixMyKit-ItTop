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
