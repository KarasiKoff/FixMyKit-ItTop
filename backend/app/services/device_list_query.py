from __future__ import annotations

from typing import Literal

from sqlalchemy import case, func, or_
from sqlalchemy.orm import Query, Session, defer, joinedload

from backend.app.models.audience import Audience as AudienceModel
from backend.app.models.category import Category as CategoryModel
from backend.app.models.device import Device as DeviceModel
from backend.app.models.enums import RepairStatus
from backend.app.models.user import User as UserModel

DeviceSortBy = Literal[
    "inventory_number",
    "name",
    "category_name",
    "audience_name",
    "responsible_name",
    "repair_status",
]
SortDir = Literal["asc", "desc"]

SUGGEST_LIMIT = 10

_REPAIR_STATUS_ORDER = case(
    (DeviceModel.repair_status == RepairStatus.NOT_IN_REPAIR, 0),
    (DeviceModel.repair_status == RepairStatus.IN_REPAIR, 1),
    else_=2,
)


def _device_list_query(db: Session) -> Query:
    return (
        db.query(DeviceModel)
        .outerjoin(CategoryModel, DeviceModel.category_id == CategoryModel.id)
        .outerjoin(AudienceModel, DeviceModel.audience_id == AudienceModel.id)
        .outerjoin(UserModel, DeviceModel.responsible_id == UserModel.id)
    )


def _contains_pattern(value: str) -> str:
    return f"%{value.strip()}%"


def _responsible_filter_clauses(responsible: str) -> list:
    pattern = _contains_pattern(responsible)
    clauses = [
        UserModel.full_name.ilike(pattern),
        UserModel.login.ilike(pattern),
    ]
    needle = responsible.strip()
    if "(" in needle and needle.endswith(")"):
        login_part = needle[needle.rfind("(") + 1 : -1].strip()
        if login_part:
            clauses.append(UserModel.login.ilike(f"%{login_part}%"))
        name_part = needle[: needle.rfind("(")].strip()
        if name_part:
            clauses.append(UserModel.full_name.ilike(f"%{name_part}%"))
    return clauses


def _apply_device_filters(
    query: Query,
    *,
    inventory_number: str | None,
    name: str | None,
    category: str | None,
    room: str | None,
    responsible: str | None,
    repair_status: RepairStatus | None,
) -> Query:
    if inventory_number:
        pattern = _contains_pattern(inventory_number)
        query = query.filter(
            or_(
                DeviceModel.inventory_number.ilike(pattern),
                DeviceModel.name.ilike(pattern),
            )
        )
    if name:
        query = query.filter(DeviceModel.name.ilike(_contains_pattern(name)))
    if category:
        query = query.filter(CategoryModel.name.ilike(_contains_pattern(category)))
    if room:
        query = query.filter(AudienceModel.name.ilike(_contains_pattern(room)))
    if responsible:
        query = query.filter(or_(*_responsible_filter_clauses(responsible)))
    if repair_status is not None:
        query = query.filter(DeviceModel.repair_status == repair_status)
    return query


def _apply_device_sort(query: Query, sort_by: DeviceSortBy, sort_dir: SortDir) -> Query:
    descending = sort_dir == "desc"
    if sort_by == "inventory_number":
        col = DeviceModel.inventory_number
    elif sort_by == "name":
        col = DeviceModel.name
    elif sort_by == "category_name":
        col = CategoryModel.name
    elif sort_by == "audience_name":
        col = AudienceModel.name
    elif sort_by == "responsible_name":
        col = func.coalesce(UserModel.full_name, UserModel.login, "")
    else:
        col = _REPAIR_STATUS_ORDER

    if descending:
        order = col.desc().nullslast()
    else:
        order = col.asc().nullsfirst()
    if sort_by != "inventory_number":
        return query.order_by(order, DeviceModel.inventory_number.asc())
    return query.order_by(order)


def fetch_devices_page(
    db: Session,
    *,
    inventory_number: str | None = None,
    name: str | None = None,
    category: str | None = None,
    room: str | None = None,
    responsible: str | None = None,
    repair_status: RepairStatus | None = None,
    sort_by: DeviceSortBy = "inventory_number",
    sort_dir: SortDir = "asc",
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[DeviceModel], int]:
    base = _apply_device_filters(
        _device_list_query(db),
        inventory_number=inventory_number,
        name=name,
        category=category,
        room=room,
        responsible=responsible,
        repair_status=repair_status,
    )
    total = base.with_entities(func.count(func.distinct(DeviceModel.id))).scalar() or 0
    items = (
        _apply_device_sort(base, sort_by, sort_dir)
        .options(
            joinedload(DeviceModel.category).defer(CategoryModel.icon_data),
            joinedload(DeviceModel.audience),
            joinedload(DeviceModel.responsible),
        )
        .offset(offset)
        .limit(limit)
        .all()
    )
    return items, total


def _responsible_label(full_name: str | None, login: str) -> str:
    name = (full_name or "").strip()
    if name:
        return f"{name} ({login})"
    return login


def suggest_devices(db: Session, field: str, q: str) -> list[str]:
    if not q.strip():
        return []

    pattern = f"%{q}%"
    limit = SUGGEST_LIMIT

    if field == "inventory_number":
        rows = (
            db.query(DeviceModel.inventory_number)
            .filter(DeviceModel.inventory_number.ilike(pattern))
            .distinct()
            .order_by(DeviceModel.inventory_number)
            .limit(limit)
            .all()
        )
        return [r[0] for r in rows]

    if field == "name":
        rows = (
            db.query(DeviceModel.name)
            .filter(DeviceModel.name.ilike(pattern))
            .distinct()
            .order_by(DeviceModel.name)
            .limit(limit)
            .all()
        )
        return [r[0] for r in rows]

    if field == "category":
        rows = (
            db.query(CategoryModel.name)
            .filter(CategoryModel.name.ilike(pattern))
            .order_by(CategoryModel.name)
            .limit(limit)
            .all()
        )
        return [r[0] for r in rows]

    if field == "room":
        rows = (
            db.query(AudienceModel.name)
            .filter(AudienceModel.name.ilike(pattern))
            .order_by(AudienceModel.name)
            .limit(limit)
            .all()
        )
        return [r[0] for r in rows]

    if field == "responsible":
        rows = (
            db.query(UserModel.full_name, UserModel.login)
            .join(DeviceModel, DeviceModel.responsible_id == UserModel.id)
            .filter(
                or_(
                    UserModel.full_name.ilike(pattern),
                    UserModel.login.ilike(pattern),
                )
            )
            .distinct()
            .order_by(UserModel.full_name, UserModel.login)
            .limit(limit)
            .all()
        )
        seen: set[str] = set()
        out: list[str] = []
        for full_name, login in rows:
            label = _responsible_label(full_name, login)
            if label not in seen:
                seen.add(label)
                out.append(label)
        return out

    return []
