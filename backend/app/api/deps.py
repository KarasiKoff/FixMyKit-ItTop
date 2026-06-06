import logging
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
from backend.app.repositories.user_repository import UserRepository
from backend.app.services.sse_ticket_service import validate_sse_ticket

logger = logging.getLogger("fixmykit.auth")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")
oauth2_scheme_optional = OAuth2PasswordBearer(
    tokenUrl="/api/auth/token", auto_error=False
)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _user_from_access_token(token: str, db: Session) -> User:
    try:
        payload = decode_access_token(token)
    except InvalidTokenError as exc:
        logger.warning("auth_token_invalid", extra={"reason": type(exc).__name__})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_token"
        ) from exc

    user_id = payload.get("sub")
    if not user_id:
        logger.warning("auth_token_missing_sub")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_token"
        )

    try:
        user_uuid = UUID(user_id)
    except ValueError:
        logger.warning("auth_token_invalid_sub", extra={"sub": str(user_id)[:36]})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_token"
        )

    user = UserRepository(db).get_active_by_id(user_uuid)
    if user is None:
        logger.warning(
            "auth_user_not_found_or_inactive", extra={"user_id": str(user_uuid)}
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_token"
        )

    logger.debug("auth_token_ok", extra={"user_id": str(user.id), "login": user.login})
    return user


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    return _user_from_access_token(token, db)


def get_optional_user(
    token: str | None = Depends(oauth2_scheme_optional),
    db: Session = Depends(get_db),
) -> User | None:
    if not token or not token.strip():
        return None
    try:
        return _user_from_access_token(token.strip(), db)
    except HTTPException:
        return None


def get_current_user_from_sse_token(
    sse_token: str = Query(
        ...,
        min_length=1,
        description="Короткоживущий SSE-токен из POST /api/events/ticket",
    ),
    db: Session = Depends(get_db),
) -> User:
    user_id = validate_sse_ticket(sse_token.strip())
    if user_id is None:
        logger.warning("sse_token_invalid")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_sse_token"
        )

    user = UserRepository(db).get_active_by_id(user_id)
    if user is None:
        logger.warning(
            "sse_token_user_not_found_or_inactive", extra={"user_id": str(user_id)}
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_sse_token"
        )

    return user


def require_admin_or_sysadmin_from_sse_token(
    current_user: User = Depends(get_current_user_from_sse_token),
) -> User:
    if current_user.role not in (UserRole.ADMIN, UserRole.SYSADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")
    return current_user


def require_roles(*allowed_roles: UserRole):
    def _dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="forbidden"
            )
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
    "get_current_user_from_sse_token",
    "get_db",
    "get_optional_user",
    "oauth2_scheme",
    "oauth2_scheme_optional",
    "require_admin_only",
    "require_admin_or_sysadmin",
    "require_admin_or_sysadmin_from_sse_token",
    "require_roles",
]
