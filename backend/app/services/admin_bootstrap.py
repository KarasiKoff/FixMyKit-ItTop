from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.core.database import SessionLocal
from backend.app.core.security import hash_password
from backend.app.models.enums import UserRole
from backend.app.models.user import User


def ensure_admin_user() -> None:
    admin_login = settings.admin_login
    admin_password = settings.admin_password

    if not admin_login or not admin_password:
        print("Admin bootstrap skipped: ADMIN_LOGIN or ADMIN_PASSWORD is not set")
        return

    db: Session = SessionLocal()
    try:
        existing_user = db.query(User).filter(User.login == admin_login).first()
        if existing_user is not None:
            return

        admin = User(
            login=admin_login,
            password_hash=hash_password(admin_password),
            role=UserRole.ADMIN,
            is_active=True,
        )
        db.add(admin)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            return
        print(f"Admin user '{admin_login}' created; password was read from .env")
    finally:
        db.close()
