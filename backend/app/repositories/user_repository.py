"""Доступ к пользователям в БД."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.models.user import User


class UserRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def get_active_by_id(self, user_id: UUID) -> User | None:
        return (
            self._db.query(User)
            .filter(User.id == user_id, User.is_active.is_(True))
            .first()
        )

    def get_active_by_login(self, login: str) -> User | None:
        return (
            self._db.query(User)
            .filter(User.login == login, User.is_active.is_(True))
            .first()
        )

    def get_by_login(self, login: str) -> User | None:
        return self._db.query(User).filter(User.login == login).first()

    def exists_by_login(self, login: str) -> bool:
        return self.get_by_login(login) is not None

    def resolve_tracker_actor(self, tracker_user_raw: str | None, fallback: User) -> User:
        raw = (tracker_user_raw or "").strip()
        if not raw:
            return fallback
        u = self.get_active_by_login(raw)
        if u is not None:
            return u
        u = (
            self._db.query(User)
            .filter(func.lower(User.login) == func.lower(raw), User.is_active.is_(True))
            .first()
        )
        if u is not None:
            return u
        u = self._db.query(User).filter(User.full_name == raw, User.is_active.is_(True)).first()
        if u is not None:
            return u
        u = (
            self._db.query(User)
            .filter(func.lower(User.full_name) == func.lower(raw), User.is_active.is_(True))
            .first()
        )
        if u is not None:
            return u
        return fallback

    def get_webhook_fallback_user(self) -> User:
        login = (settings.tracker_webhook_actor_login or "tracker_webhook").strip() or "tracker_webhook"
        fallback = self.get_by_login(login)
        if fallback is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="webhook_actor_missing_restart_app",
            )
        return fallback
