import logging

from fastapi import APIRouter, Body, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user, get_db
from backend.app.models.user import User
from backend.app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from backend.app.repositories.user_repository import UserRepository
from backend.app.schemas.auth import LoginRequest, SelfPasswordUpdate, Token
from backend.app.schemas.user import UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger("fixmykit.auth")


def authenticate_user(login: str, password: str, db: Session) -> Token:
    user = UserRepository(db).get_active_by_login(login)
    if user is None or not verify_password(password, user.password_hash):
        logger.warning("auth_login_failed", extra={"login": login.strip()[:64]})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect login or password",
        )
    token = create_access_token(str(user.id))
    logger.info(
        "auth_login_success",
        extra={"user_id": str(user.id), "login": user.login, "role": user.role.value},
    )
    return Token(access_token=token)


@router.post("/login", response_model=Token)
def login(
    credentials: LoginRequest | None = Body(default=None),
    db: Session = Depends(get_db),
) -> Token:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid login payload",
        )

    return authenticate_user(credentials.login, credentials.password, db)


@router.post("/token", response_model=Token, include_in_schema=False)
def login_for_swagger(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> Token:
    return authenticate_user(form_data.username, form_data.password, db)


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_own_password(
    payload: SelfPasswordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_current_password"
        )

    current_user.password_hash = hash_password(payload.new_password)
    UserRepository(db).commit()
