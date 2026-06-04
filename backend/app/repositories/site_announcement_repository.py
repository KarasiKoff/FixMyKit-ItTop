"""Баннеры объявлений на сайте."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from backend.app.models.site_announcement import SiteAnnouncement
from backend.app.schemas.site_announcement import SLOT_MAX, SLOT_MIN


class SiteAnnouncementRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def all_slots(self) -> list[SiteAnnouncement]:
        return self._db.query(SiteAnnouncement).all()

    def list_in_slot_range(self) -> list[SiteAnnouncement]:
        return (
            self._db.query(SiteAnnouncement)
            .filter(SiteAnnouncement.slot.between(SLOT_MIN, SLOT_MAX))
            .all()
        )

    def list_admin_with_editor(self) -> list[SiteAnnouncement]:
        return (
            self._db.query(SiteAnnouncement)
            .options(joinedload(SiteAnnouncement.updated_by))
            .filter(SiteAnnouncement.slot.between(SLOT_MIN, SLOT_MAX))
            .order_by(SiteAnnouncement.slot)
            .all()
        )

    def list_active_candidates(self, now: datetime) -> list[SiteAnnouncement]:
        return (
            self._db.query(SiteAnnouncement)
            .filter(
                SiteAnnouncement.is_enabled.is_(True),
                SiteAnnouncement.message != "",
                or_(SiteAnnouncement.starts_at.is_(None), SiteAnnouncement.starts_at <= now),
                or_(SiteAnnouncement.ends_at.is_(None), SiteAnnouncement.ends_at >= now),
            )
            .all()
        )
