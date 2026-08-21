"""Технический пользователь для входящих webhook Jira / Yandex Tracker."""

import secrets

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.core.database import SessionLocal
from backend.app.core.security import hash_password
from backend.app.models.enums import UserRole
from backend.app.models.user import User
from backend.app.repositories.user_repository import UserRepository

_LEGACY_WEBHOOK_NAMES = frozenset({"Yandex.Tracker", "Yandex Tracker"})


def _webhook_actor_display_name() -> str:
    label = (settings.server.external_tracker_label() or "").strip()
    if label:
        return label
    return "Внешний трекер"


def ensure_tracker_webhook_actor() -> None:
    has_yandex = bool((settings.server.tracker_webhook_secret or "").strip())
    has_jira = bool((settings.server.jira_webhook_secret or "").strip())
    if not has_yandex and not has_jira:
        return

    login = (
        settings.server.tracker_webhook_actor_login or "tracker_webhook"
    ).strip() or "tracker_webhook"
    display_name = _webhook_actor_display_name()

    db: Session = SessionLocal()
    try:
        repo = UserRepository(db)
        existing = repo.get_by_login(login)
        if existing is not None:
            if (existing.full_name or "").strip() in _LEGACY_WEBHOOK_NAMES:
                existing.full_name = display_name
                db.commit()
            return
        user = User(
            login=login,
            password_hash=hash_password(secrets.token_urlsafe(32)),
            role=UserRole.SYSADMIN,
            full_name=display_name,
            is_active=True,
        )
        repo.add(user)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
    finally:
        db.close()
