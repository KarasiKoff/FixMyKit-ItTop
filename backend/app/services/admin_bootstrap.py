from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.core.database import SessionLocal
from backend.app.core.security import hash_password
from backend.app.models.enums import UserRole
from backend.app.models.user import User
from backend.app.repositories.user_repository import UserRepository


def ensure_admin_user() -> None:
    admin_login = settings.server.admin_login
    admin_password = settings.server.admin_password

    if not admin_login or not admin_password:
        print("Admin bootstrap skipped: ADMIN_LOGIN or ADMIN_PASSWORD is not set")
        return

    db: Session = SessionLocal()
    try:
        existing_user = UserRepository(db).get_by_login(admin_login)
        if existing_user is not None:
            return

        admin = User(
            login=admin_login,
            password_hash=hash_password(admin_password),
            role=UserRole.ADMIN,
            is_active=True,
        )
        UserRepository(db).add(admin)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            return
        print(f"Admin user '{admin_login}' created; password was read from .env")
    finally:
        db.close()
