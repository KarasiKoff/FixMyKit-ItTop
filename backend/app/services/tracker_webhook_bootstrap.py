"""Технический пользователь для закрытия заявок из вебхука Yandex Tracker"""

import secrets

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.core.database import SessionLocal
from backend.app.core.security import hash_password
from backend.app.models.enums import UserRole
from backend.app.models.user import User
from backend.app.repositories.user_repository import UserRepository


def ensure_tracker_webhook_actor() -> None:
    secret = (settings.server.tracker_webhook_secret or "").strip()
    if not secret:
        return

    login = (
        settings.server.tracker_webhook_actor_login or "tracker_webhook"
    ).strip() or "tracker_webhook"
    db: Session = SessionLocal()
    try:
        if UserRepository(db).exists_by_login(login):
            return
        user = User(
            login=login,
            password_hash=hash_password(secrets.token_urlsafe(32)),
            role=UserRole.SYSADMIN,
            full_name="Yandex.Tracker",
            is_active=True,
        )
        UserRepository(db).add(user)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
    finally:
        db.close()
