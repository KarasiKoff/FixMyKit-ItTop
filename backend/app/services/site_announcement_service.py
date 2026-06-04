from datetime import datetime, timezone

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from backend.app.models.enums import AnnouncementAudience, AnnouncementSeverity, UserRole
from backend.app.models.site_announcement import SiteAnnouncement
from backend.app.models.user import User
from backend.app.schemas.site_announcement import (
    SLOT_MAX,
    SLOT_MIN,
    AdminAnnouncementsResponse,
    ResetDismissalsResponse,
    SiteAnnouncementSlot,
    SiteAnnouncementSlotAdmin,
    SiteAnnouncementSlotPublic,
)

_STAFF_ROLES = (UserRole.ADMIN, UserRole.SYSADMIN)

_SEVERITY_ORDER = {
    AnnouncementSeverity.DANGER: 0,
    AnnouncementSeverity.WARNING: 1,
    AnnouncementSeverity.INFO: 2,
}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _is_active_now(row: SiteAnnouncement, now: datetime) -> bool:
    if not row.is_enabled or not (row.message or "").strip():
        return False
    if row.starts_at is not None and row.starts_at > now:
        return False
    if row.ends_at is not None and row.ends_at < now:
        return False
    return True


def _row_to_admin_slot(row: SiteAnnouncement, now: datetime) -> SiteAnnouncementSlotAdmin:
    editor = row.updated_by
    return SiteAnnouncementSlotAdmin(
        slot=row.slot,
        is_enabled=row.is_enabled,
        message=row.message or "",
        audience=row.audience,
        severity=row.severity,
        link_url=row.link_url,
        emoji=row.emoji,
        starts_at=row.starts_at,
        ends_at=row.ends_at,
        updated_at=row.updated_at,
        updated_by_login=editor.login if editor else None,
        active_now=_is_active_now(row, now),
        dismiss_version=row.dismiss_version or 1,
    )


def ensure_announcement_slots(db: Session) -> None:
    existing = {row.slot for row in db.query(SiteAnnouncement).all()}
    added = False
    for slot in range(SLOT_MIN, SLOT_MAX + 1):
        if slot not in existing:
            db.add(SiteAnnouncement(slot=slot))
            added = True
    if added:
        db.commit()


def list_admin_slots(db: Session) -> AdminAnnouncementsResponse:
    ensure_announcement_slots(db)
    now = _utc_now()
    rows = (
        db.query(SiteAnnouncement)
        .options(joinedload(SiteAnnouncement.updated_by))
        .filter(SiteAnnouncement.slot.between(SLOT_MIN, SLOT_MAX))
        .order_by(SiteAnnouncement.slot)
        .all()
    )
    return AdminAnnouncementsResponse(slots=[_row_to_admin_slot(row, now) for row in rows])


def update_admin_slots(
    db: Session,
    payload: list[SiteAnnouncementSlot],
    actor: User,
) -> AdminAnnouncementsResponse:
    ensure_announcement_slots(db)
    by_slot = {item.slot: item for item in payload}
    rows = (
        db.query(SiteAnnouncement)
        .filter(SiteAnnouncement.slot.between(SLOT_MIN, SLOT_MAX))
        .all()
    )
    for row in rows:
        item = by_slot.get(row.slot)
        if item is None:
            continue
        row.is_enabled = item.is_enabled
        row.message = item.message.strip()
        row.audience = item.audience
        row.severity = item.severity
        row.link_url = item.link_url
        row.emoji = item.emoji
        row.starts_at = item.starts_at
        row.ends_at = item.ends_at
        row.updated_by_user_id = actor.id
    db.commit()
    return list_admin_slots(db)


def reset_dismissals(db: Session) -> ResetDismissalsResponse:
    ensure_announcement_slots(db)
    rows = (
        db.query(SiteAnnouncement)
        .filter(SiteAnnouncement.slot.between(SLOT_MIN, SLOT_MAX))
        .all()
    )
    new_version = 1
    for row in rows:
        row.dismiss_version = (row.dismiss_version or 1) + 1
        new_version = row.dismiss_version
    db.commit()
    return ResetDismissalsResponse(dismiss_version=new_version)


def list_active_for_viewer(db: Session, user: User | None) -> list[SiteAnnouncementSlotPublic]:
    is_staff = user is not None and user.role in _STAFF_ROLES
    now = _utc_now()
    rows = (
        db.query(SiteAnnouncement)
        .filter(
            SiteAnnouncement.is_enabled.is_(True),
            SiteAnnouncement.message != "",
            or_(SiteAnnouncement.starts_at.is_(None), SiteAnnouncement.starts_at <= now),
            or_(SiteAnnouncement.ends_at.is_(None), SiteAnnouncement.ends_at >= now),
        )
        .all()
    )
    items: list[SiteAnnouncementSlotPublic] = []
    for row in rows:
        if row.audience == AnnouncementAudience.ADMINS_ONLY and not is_staff:
            continue
        items.append(
            SiteAnnouncementSlotPublic(
                slot=row.slot,
                message=row.message.strip(),
                severity=row.severity,
                audience=row.audience,
                link_url=row.link_url,
                emoji=row.emoji,
                dismiss_version=row.dismiss_version or 1,
            )
        )
    items.sort(key=lambda item: (_SEVERITY_ORDER[item.severity], item.slot))
    return items
