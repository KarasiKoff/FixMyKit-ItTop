from __future__ import annotations

from typing import Literal

from sqlalchemy import case, func, or_
from sqlalchemy.orm import Query, Session, joinedload

from backend.app.models.device import Device as DeviceModel
from backend.app.models.enums import RequestStatus
from backend.app.models.repair_request import RepairRequest as RepairRequestModel

RepairRequestSortBy = Literal["created_at", "device_inventory_number", "applicant_name", "status"]
SortDir = Literal["asc", "desc"]

SUGGEST_LIMIT = 10

_STATUS_ORDER = case(
    (RepairRequestModel.status == RequestStatus.OPEN, 0),
    (RepairRequestModel.status == RequestStatus.IN_PROGRESS, 1),
    (RepairRequestModel.status == RequestStatus.CLOSED, 2),
    else_=3,
)


def _repair_request_list_query(db: Session) -> Query:
    return db.query(RepairRequestModel).outerjoin(
        DeviceModel, RepairRequestModel.device_id == DeviceModel.id
    )


def _apply_repair_request_filters(
    query: Query,
    *,
    device: str | None,
    applicant: str | None,
    status: RequestStatus | None,
) -> Query:
    if device:
        pattern = f"%{device.strip()}%"
        query = query.filter(
            or_(
                DeviceModel.inventory_number.ilike(pattern),
                DeviceModel.name.ilike(pattern),
            )
        )
    if applicant:
        query = query.filter(RepairRequestModel.applicant_name.ilike(f"%{applicant.strip()}%"))
    if status is not None:
        query = query.filter(RepairRequestModel.status == status)
    return query


def _apply_repair_request_sort(query: Query, sort_by: RepairRequestSortBy, sort_dir: SortDir) -> Query:
    descending = sort_dir == "desc"
    if sort_by == "created_at":
        col = RepairRequestModel.created_at
    elif sort_by == "device_inventory_number":
        col = DeviceModel.inventory_number
    elif sort_by == "applicant_name":
        col = RepairRequestModel.applicant_name
    else:
        col = _STATUS_ORDER

    if descending:
        order = col.desc().nullslast()
    else:
        order = col.asc().nullsfirst()
    if sort_by == "created_at":
        return query.order_by(order)
    tie = RepairRequestModel.created_at.desc()
    return query.order_by(order, tie)


def fetch_repair_requests_page(
    db: Session,
    *,
    device: str | None = None,
    applicant: str | None = None,
    status: RequestStatus | None = None,
    sort_by: RepairRequestSortBy = "created_at",
    sort_dir: SortDir = "desc",
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[RepairRequestModel], int]:
    base = _apply_repair_request_filters(
        _repair_request_list_query(db),
        device=device,
        applicant=applicant,
        status=status,
    )
    total = base.with_entities(func.count(func.distinct(RepairRequestModel.id))).scalar() or 0
    items = (
        _apply_repair_request_sort(base, sort_by, sort_dir)
        .options(joinedload(RepairRequestModel.device))
        .offset(offset)
        .limit(limit)
        .all()
    )
    return items, total


def suggest_repair_requests(db: Session, field: str, q: str) -> list[str]:
    if not q.strip():
        return []

    pattern = f"%{q}%"
    limit = SUGGEST_LIMIT

    if field == "applicant":
        rows = (
            db.query(RepairRequestModel.applicant_name)
            .filter(
                RepairRequestModel.applicant_name.isnot(None),
                RepairRequestModel.applicant_name.ilike(pattern),
            )
            .distinct()
            .order_by(RepairRequestModel.applicant_name)
            .limit(limit)
            .all()
        )
        return [r[0] for r in rows if r[0]]

    if field == "device":
        inv_rows = (
            db.query(DeviceModel.inventory_number)
            .filter(DeviceModel.inventory_number.ilike(pattern))
            .distinct()
            .order_by(DeviceModel.inventory_number)
            .limit(limit)
            .all()
        )
        name_rows = (
            db.query(DeviceModel.name)
            .filter(DeviceModel.name.ilike(pattern))
            .distinct()
            .order_by(DeviceModel.name)
            .limit(limit)
            .all()
        )
        seen: set[str] = set()
        out: list[str] = []
        for (value,) in inv_rows + name_rows:
            if value not in seen:
                seen.add(value)
                out.append(value)
            if len(out) >= limit:
                break
        return out

    return []
