from datetime import UTC, datetime, timedelta

import jwt
import bcrypt

from backend.app.core.config import settings


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def create_access_token(subject: str) -> str:
    expires_at = datetime.now(UTC) + timedelta(
        minutes=settings.server.access_token_expire_minutes
    )
    payload = {"sub": subject, "exp": expires_at}
    return jwt.encode(
        payload, settings.server.jwt_secret_key, algorithm=settings.server.jwt_algorithm
    )


def decode_access_token(token: str) -> dict:
    return jwt.decode(
        token,
        settings.server.jwt_secret_key,
        algorithms=[settings.server.jwt_algorithm],
    )
