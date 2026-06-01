from collections.abc import Generator
from uuid import UUID

from fastapi import Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordBearer
from jwt import InvalidTokenError
from sqlalchemy.orm import Session

from backend.app.core.database import SessionLocal
from backend.app.core.security import decode_access_token
from backend.app.models.enums import UserRole
from backend.app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _user_from_access_token(token: str, db: Session) -> User:
    try:
        payload = decode_access_token(token)
    except InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_token")

    try:
        user_uuid = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_token")

    user = db.query(User).filter(User.id == user_uuid, User.is_active.is_(True)).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_token")

    return user


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    return _user_from_access_token(token, db)


def get_current_user_from_query_token(
    access_token: str = Query(..., min_length=1, description="JWT для EventSource (SSE)"),
    db: Session = Depends(get_db),
) -> User:
    return _user_from_access_token(access_token.strip(), db)


def require_admin_or_sysadmin_from_token(
    current_user: User = Depends(get_current_user_from_query_token),
) -> User:
    if current_user.role not in (UserRole.ADMIN, UserRole.SYSADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")
    return current_user


def require_roles(*allowed_roles: UserRole):
    def _dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")
        return current_user

    return _dependency


def require_admin_only(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")
    return current_user


require_admin_or_sysadmin = require_roles(UserRole.ADMIN, UserRole.SYSADMIN)
get_current_admin = require_admin_only


__all__ = [
    "get_current_admin",
    "get_current_user",
    "get_current_user_from_query_token",
    "get_db",
    "oauth2_scheme",
    "require_admin_only",
    "require_admin_or_sysadmin",
    "require_admin_or_sysadmin_from_token",
    "require_roles",
]
