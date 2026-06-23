from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_admin, get_db, require_admin_or_sysadmin
from backend.app.core.security import hash_password
from backend.app.models.user import User
from backend.app.repositories.user_repository import UserRepository
from backend.app.schemas.user import (
    UserCreateAdmin,
    UserListResponse,
    UserPasswordUpdate,
    UserResponse,
    UserUpdateAdmin,
)

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=UserListResponse)
def get_users(
    role: str | None = Query(None, description="Filter by role"),
    is_active: bool | None = Query(None, description="Filter by active status"),
    search: str | None = Query(None, description="Search in login or full_name"),
    limit: int = Query(10, ge=1, le=100, description="Limit number of results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_sysadmin),
) -> UserListResponse:
    users, total = UserRepository(db).list_paginated(
        role=role,
        is_active=is_active,
        search=search,
        limit=limit,
        offset=offset,
    )
    return UserListResponse(
        items=[UserResponse.model_validate(user) for user in users],
        total=total,
    )


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_data: UserCreateAdmin,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> UserResponse:
    if UserRepository(db).exists_by_login(user_data.login):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="login_exists")

    if user_data.tracker_user_email:
        existing_email = UserRepository(db).get_by_tracker_email(
            str(user_data.tracker_user_email)
        )
        if existing_email is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="tracker_user_email_exists",
            )

    new_user = User(
        login=user_data.login,
        password_hash=hash_password(user_data.password),
        role=user_data.role,
        full_name=user_data.full_name,
        tracker_user_email=(
            str(user_data.tracker_user_email).strip().lower()
            if user_data.tracker_user_email
            else None
        ),
        is_active=True,
    )
    new_user = UserRepository(db).create(new_user)

    return UserResponse.model_validate(new_user)


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: UUID,
    user_data: UserUpdateAdmin,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> UserResponse:
    user = UserRepository(db).get_or_404(user_id)

    update_data = user_data.model_dump(exclude_unset=True)
    if "tracker_user_email" in update_data:
        email = update_data["tracker_user_email"]
        if email is None:
            update_data["tracker_user_email"] = None
        else:
            normalized = str(email).strip().lower()
            other = UserRepository(db).get_by_tracker_email(normalized)
            if other is not None and other.id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="tracker_user_email_exists",
                )
            update_data["tracker_user_email"] = normalized or None
    if user_id == current_admin.id and update_data.get("is_active") is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="cannot_deactivate_self",
        )
    if user_id == current_admin.id and "role" in update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="cannot_change_own_role",
        )
    for key, value in update_data.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)

    return UserResponse.model_validate(user)


@router.patch("/{user_id}/password", status_code=status.HTTP_204_NO_CONTENT)
def admin_reset_user_password(
    user_id: UUID,
    password_data: UserPasswordUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> None:
    user = UserRepository(db).get_or_404(user_id)
    user.password_hash = hash_password(password_data.password)
    db.commit()
