"""Чтение и загрузка заявок на ремонт из БД."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from backend.app.models.device import Device
from backend.app.models.repair_request import RepairRequest
from backend.app.schemas.repair_request import RepairRequestDetail
from backend.app.services.repair_request_attachment_service import refresh_attachment_fields_from_disk


class RepairRequestRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def get_or_404(
        self,
        request_id: UUID,
        *,
        for_tracker: bool = False,
    ) -> RepairRequest:
        q = self._db.query(RepairRequest).filter(RepairRequest.id == request_id)
        if for_tracker:
            q = q.options(
                joinedload(RepairRequest.device).joinedload(Device.audience),
                joinedload(RepairRequest.audience),
                joinedload(RepairRequest.author),
            )
        repair_request = q.first()
        if repair_request is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="repair_request_not_found",
            )
        return repair_request

    def load_detail(self, request_id: UUID) -> RepairRequestDetail:
        repair_request = (
            self._db.query(RepairRequest)
            .options(joinedload(RepairRequest.device), joinedload(RepairRequest.audience))
            .filter(RepairRequest.id == request_id)
            .first()
        )
        if repair_request is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="repair_request_not_found",
            )
        refresh_attachment_fields_from_disk(repair_request)
        self._db.commit()
        return RepairRequestDetail.model_validate(repair_request)

    def find_for_tracker(self, issue_key: str, issue_id: str) -> RepairRequest:
        key = (issue_key or "").strip()
        iid = (issue_id or "").strip()
        q = self._db.query(RepairRequest)
        if key:
            repair_request = q.filter(RepairRequest.tracker_ticket_key == key).first()
        else:
            repair_request = q.filter(RepairRequest.tracker_ticket_id == iid).first()
        if repair_request is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="repair_request_not_found_for_tracker_issue",
            )
        return repair_request


def get_repair_request_or_404(
    db: Session,
    request_id: UUID,
    *,
    for_tracker: bool = False,
) -> RepairRequest:
    return RepairRequestRepository(db).get_or_404(request_id, for_tracker=for_tracker)


def load_repair_request_detail(db: Session, request_id: UUID) -> RepairRequestDetail:
    return RepairRequestRepository(db).load_detail(request_id)


def find_repair_request_for_tracker(
    db: Session,
    issue_key: str,
    issue_id: str,
) -> RepairRequest:
    return RepairRequestRepository(db).find_for_tracker(issue_key, issue_id)
