from datetime import date, datetime, time, timezone

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from backend.app.models.audience import Audience
from backend.app.models.category import Category
from backend.app.models.device import Device
from backend.app.models.enums import RequestStatus
from backend.app.models.repair_request import RepairRequest
from backend.app.schemas.admin_stats import (
    AdminStatsResponse,
    CatalogStats,
    CategoryDeviceCount,
    RepairRequestStats,
)

RESOLUTION_WONT_FIX = "Не будет исправлено"
RESOLUTION_RESOLVED = "Решен"


def _date_range_bounds(date_from: date | None, date_to: date | None) -> tuple[datetime | None, datetime | None]:
    start = datetime.combine(date_from, time.min, tzinfo=timezone.utc) if date_from else None
    end = datetime.combine(date_to, time.max, tzinfo=timezone.utc) if date_to else None
    return start, end


def _created_in_range(start: datetime | None, end: datetime | None):
    clauses = []
    if start is not None:
        clauses.append(RepairRequest.created_at >= start)
    if end is not None:
        clauses.append(RepairRequest.created_at <= end)
    return and_(*clauses) if clauses else None


def _sync_in_range(start: datetime | None, end: datetime | None):
    clauses = [
        RepairRequest.tracker_ticket_id.isnot(None),
        RepairRequest.tracker_ticket_id != "",
    ]
    if start is not None:
        clauses.append(RepairRequest.last_sync_at >= start)
    if end is not None:
        clauses.append(RepairRequest.last_sync_at <= end)
    return and_(*clauses)


def build_admin_stats(db: Session, date_from: date | None, date_to: date | None) -> AdminStatsResponse:
    start, end = _date_range_bounds(date_from, date_to)
    created_filter = _created_in_range(start, end)
    sync_filter = _sync_in_range(start, end)
    closed = RepairRequest.status == RequestStatus.CLOSED

    total_q = db.query(func.count(RepairRequest.id))
    if created_filter is not None:
        total_q = total_q.filter(created_filter)
    total = int(total_q.scalar() or 0)

    open_q = db.query(func.count(RepairRequest.id)).filter(RepairRequest.status == RequestStatus.OPEN)
    if created_filter is not None:
        open_q = open_q.filter(created_filter)
    open_count = int(open_q.scalar() or 0)

    in_progress_q = db.query(func.count(RepairRequest.id)).filter(
        RepairRequest.status == RequestStatus.IN_PROGRESS,
    )
    if created_filter is not None:
        in_progress_q = in_progress_q.filter(created_filter)
    in_progress = int(in_progress_q.scalar() or 0)

    wont_fix_q = db.query(func.count(RepairRequest.id)).filter(
        closed,
        or_(
            RepairRequest.resolution_note == RESOLUTION_WONT_FIX,
            RepairRequest.resolution_desc == RESOLUTION_WONT_FIX,
        ),
    )
    if created_filter is not None:
        wont_fix_q = wont_fix_q.filter(created_filter)
    wont_fix_count = int(wont_fix_q.scalar() or 0)

    resolved_q = db.query(func.count(RepairRequest.id)).filter(
        or_(
            RepairRequest.resolution_note == RESOLUTION_RESOLVED,
            RepairRequest.resolution_desc == RESOLUTION_RESOLVED,
        ),
    )
    if created_filter is not None:
        resolved_q = resolved_q.filter(created_filter)
    resolved = int(resolved_q.scalar() or 0)

    tracker_synced = int(db.query(func.count(RepairRequest.id)).filter(sync_filter).scalar() or 0)

    devices_total = int(db.query(func.count(Device.id)).scalar() or 0)
    categories_total = int(db.query(func.count(Category.id)).scalar() or 0)
    audiences_total = int(db.query(func.count(Audience.id)).scalar() or 0)

    category_rows = (
        db.query(
            Category.id,
            Category.name,
            func.count(Device.id).label("device_count"),
        )
        .outerjoin(Device, Device.category_id == Category.id)
        .group_by(Category.id, Category.name)
        .order_by(func.count(Device.id).desc(), Category.name.asc())
        .all()
    )

    uncategorized = int(
        db.query(func.count(Device.id)).filter(Device.category_id.is_(None)).scalar() or 0,
    )

    devices_by_category: list[CategoryDeviceCount] = []
    for cat_id, cat_name, count in category_rows:
        if count <= 0:
            continue
        share = round((count / devices_total) * 100, 1) if devices_total else 0.0
        devices_by_category.append(
            CategoryDeviceCount(
                category_id=cat_id,
                category_name=cat_name,
                device_count=int(count),
                share_percent=share,
            ),
        )

    if uncategorized > 0:
        share = round((uncategorized / devices_total) * 100, 1) if devices_total else 0.0
        devices_by_category.append(
            CategoryDeviceCount(
                category_id=None,
                category_name="Без категории",
                device_count=uncategorized,
                share_percent=share,
            ),
        )

    last_sync_row = (
        db.query(RepairRequest.last_sync_at)
        .filter(RepairRequest.last_sync_at.isnot(None))
        .order_by(RepairRequest.last_sync_at.desc())
        .first()
    )
    last_tracker_sync_at = last_sync_row[0] if last_sync_row else None

    return AdminStatsResponse(
        date_from=date_from,
        date_to=date_to,
        repair_requests=RepairRequestStats(
            total=total,
            open=open_count,
            in_progress=in_progress,
            resolved=resolved,
            wont_fix=wont_fix_count,
            tracker_synced=tracker_synced,
        ),
        catalog=CatalogStats(
            devices_total=devices_total,
            categories_total=categories_total,
            audiences_total=audiences_total,
        ),
        devices_by_category=devices_by_category,
        last_tracker_sync_at=last_tracker_sync_at,
    )
