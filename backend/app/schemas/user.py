from datetime import datetime
from typing import List
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from backend.app.models.enums import UserRole


class UserBase(BaseModel):
    login: str
    role: UserRole = UserRole.ADMIN
    full_name: str | None = None
    is_active: bool = True


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)


class UserCreateAdmin(BaseModel):
    login: str
    password: str = Field(..., min_length=8)
    role: UserRole = Field(..., description="Role must be admin or sysadmin")
    full_name: str | None = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        if v not in [UserRole.ADMIN, UserRole.SYSADMIN]:
            raise ValueError("Role must be admin or sysadmin")
        return v


class UserUpdate(BaseModel):
    login: str | None = None
    role: UserRole | None = None
    full_name: str | None = None
    is_active: bool | None = None


class UserUpdateAdmin(BaseModel):
    role: UserRole | None = None
    full_name: str | None = None
    is_active: bool | None = None


class UserPasswordUpdate(BaseModel):
    password: str = Field(..., min_length=8)


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


class UserListResponse(BaseModel):
    items: List[UserResponse]
    total: int


class UserLogin(BaseModel):
    login: str
    password: str
