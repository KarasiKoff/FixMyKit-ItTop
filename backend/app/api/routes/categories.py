from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user, get_db, require_roles
from backend.app.models.enums import UserRole
from backend.app.models.user import User
from backend.app.schemas.category import Category, CategoryCreate, CategoryList, CategoryUpdate
from backend.app.schemas.subcategory import Subcategory, SubcategoryCreate, SubcategoryUpdate
from backend.app.services import category_route_service as category_svc

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("", response_model=CategoryList)
def list_categories(
    is_active: bool | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.SYSADMIN)),
) -> CategoryList:
    return category_svc.list_categories(db, is_active=is_active)


@router.get("/{category_id}/icon")
def get_category_icon(
    category_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return category_svc.category_icon_response(db, category_id)


@router.post("", response_model=Category, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> Category:
    return category_svc.create_category(db, payload)


@router.post("/{category_id}/icon", response_model=Category)
async def upload_category_icon(
    category_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
    file: UploadFile = File(...),
) -> Category:
    return await category_svc.upload_category_icon(db, category_id, file)


@router.delete("/{category_id}/icon", response_model=Category)
def delete_category_icon(
    category_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> Category:
    return category_svc.delete_category_icon(db, category_id)


@router.patch("/{category_id}", response_model=Category)
def update_category(
    category_id: UUID,
    payload: CategoryUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> Category:
    return category_svc.update_category(db, category_id, payload)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> None:
    category_svc.delete_category(db, category_id)


@router.post(
    "/{category_id}/subcategories",
    response_model=Subcategory,
    status_code=status.HTTP_201_CREATED,
)
def create_subcategory(
    category_id: UUID,
    payload: SubcategoryCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> Subcategory:
    return category_svc.create_subcategory(db, category_id, payload)


@router.patch("/subcategories/{subcategory_id}", response_model=Subcategory)
def update_subcategory(
    subcategory_id: UUID,
    payload: SubcategoryUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> Subcategory:
    return category_svc.update_subcategory(db, subcategory_id, payload)


@router.delete("/subcategories/{subcategory_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subcategory(
    subcategory_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> None:
    category_svc.delete_subcategory(db, subcategory_id)
