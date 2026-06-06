import logging

from fastapi import APIRouter, Body, Depends, HTTPException, status
from fastapi.responses import JSONResponse, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user, get_db
from backend.app.core.auth_cookies import clear_auth_cookie, set_auth_cookie
from backend.app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from backend.app.models.user import User
from backend.app.repositories.user_repository import UserRepository
from backend.app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    SelfPasswordUpdate,
    Token,
)
from backend.app.schemas.user import UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger("fixmykit.auth")


def _issue_token(login: str, password: str, db: Session) -> str:
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
    return token


def _login_json_response(
    access_token: str, *, include_token_in_body: bool
) -> JSONResponse:
    body: dict[str, str] = {"token_type": "bearer"}
    if include_token_in_body:
        body["access_token"] = access_token
    response = JSONResponse(content=body)
    set_auth_cookie(response, access_token)
    return response


@router.post("/login", response_model=LoginResponse)
def login(
    credentials: LoginRequest | None = Body(default=None),
    db: Session = Depends(get_db),
) -> JSONResponse:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid login payload",
        )

    token = _issue_token(credentials.login, credentials.password, db)
    return _login_json_response(token, include_token_in_body=False)


@router.post("/token", response_model=Token, include_in_schema=False)
def login_for_swagger(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> JSONResponse:
    token = _issue_token(form_data.username, form_data.password, db)
    return _login_json_response(token, include_token_in_body=True)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout() -> Response:
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    clear_auth_cookie(response)
    return response


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
