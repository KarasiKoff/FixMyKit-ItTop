from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SubcategoryBase(BaseModel):
    name: str
    is_active: bool = True


class SubcategoryCreate(BaseModel):
    name: str


class SubcategoryUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None


class Subcategory(SubcategoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    category_id: UUID
    created_at: datetime
