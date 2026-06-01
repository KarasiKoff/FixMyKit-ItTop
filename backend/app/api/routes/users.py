from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_admin, get_db, require_admin_or_sysadmin
from backend.app.core.security import hash_password
from backend.app.models.user import User
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
    query = db.query(User)

    if role:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    if search:
        query = query.filter(
            (User.login.ilike(f"%{search}%")) | (User.full_name.ilike(f"%{search}%"))
        )

    total = query.count()
    users = query.offset(offset).limit(limit).all()

    return UserListResponse(
        items=[UserResponse.model_validate(user) for user in users], total=total
    )


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_data: UserCreateAdmin,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> UserResponse:
    # Check if login already exists
    existing_user = db.query(User).filter(User.login == user_data.login).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="login_exists")

    new_user = User(
        login=user_data.login,
        password_hash=hash_password(user_data.password),
        role=user_data.role,
        full_name=user_data.full_name,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return UserResponse.model_validate(new_user)


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: UUID,
    user_data: UserUpdateAdmin,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> UserResponse:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="user_not_found"
        )

    update_data = user_data.model_dump(exclude_unset=True)
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
    """Сброс пароля пользователя администратором (без знания старого пароля)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="user_not_found"
        )

    user.password_hash = hash_password(password_data.password)
    db.commit()
