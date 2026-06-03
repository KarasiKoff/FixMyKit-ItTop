from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from backend.app.schemas.subcategory import Subcategory


class CategoryBase(BaseModel):
    name: str
    is_active: bool = True


class CategoryCreate(BaseModel):
    name: str


class CategoryUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None


class Category(CategoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    has_icon: bool = False


class CategoryWithSubcategories(Category):
    subcategories: list[Subcategory] = []


class CategoryList(BaseModel):
    items: list[CategoryWithSubcategories]
