from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user, get_db
from backend.app.models.category import Category as CategoryModel
from backend.app.models.enums import UserRole
from backend.app.models.subcategory import Subcategory as SubcategoryModel
from backend.app.models.user import User
from backend.app.repositories.category_repository import CategoryRepository, SubcategoryRepository
from backend.app.schemas.category import (
    Category,
    CategoryCreate,
    CategoryList,
    CategoryUpdate,
    CategoryWithSubcategories,
)
from backend.app.schemas.subcategory import Subcategory, SubcategoryCreate, SubcategoryUpdate
from backend.app.services.category_icon_service import validate_and_prepare_icon

router = APIRouter(prefix="/api/categories", tags=["categories"])


def require_roles(allowed_roles: set[UserRole]):
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")
        return user

    return checker


@router.get("", response_model=CategoryList)
def list_categories(
    is_active: bool | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles({UserRole.ADMIN, UserRole.SYSADMIN})),
) -> CategoryList:
    items = CategoryRepository(db).list_all(is_active=is_active)
    return CategoryList(items=[CategoryWithSubcategories.model_validate(item) for item in items])


@router.get("/{category_id}/icon")
def get_category_icon(
    category_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Response:
    category = CategoryRepository(db).get_or_404(category_id)
    if not category.icon_mime or not category.icon_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="icon_not_found")
    return Response(
        content=bytes(category.icon_data),
        media_type=category.icon_mime,
        headers={"Cache-Control": "public, max-age=3600"},
    )


@router.post("", response_model=Category, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles({UserRole.ADMIN})),
) -> Category:
    if CategoryRepository(db).get_by_name(payload.name) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="category_exists")

    category = CategoryModel(name=payload.name)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.post("/{category_id}/icon", response_model=Category)
async def upload_category_icon(
    category_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles({UserRole.ADMIN})),
    file: UploadFile = File(...),
) -> Category:
    category = CategoryRepository(db).get_or_404(category_id)

    raw = await file.read()
    try:
        mime, data = validate_and_prepare_icon(raw)
    except ValueError as e:
        code = str(e)
        if code == "icon_too_large":
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=code)
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=code)

    category.icon_mime = mime
    category.icon_data = data
    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}/icon", response_model=Category)
def delete_category_icon(
    category_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles({UserRole.ADMIN})),
) -> Category:
    category = CategoryRepository(db).get_or_404(category_id)
    category.icon_mime = None
    category.icon_data = None
    db.commit()
    db.refresh(category)
    return category


@router.patch("/{category_id}", response_model=Category)
def update_category(
    category_id: UUID,
    payload: CategoryUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles({UserRole.ADMIN})),
) -> Category:
    repo = CategoryRepository(db)
    category = repo.get_or_404(category_id)

    if payload.name is not None and payload.name != category.name:
        if repo.get_by_name(payload.name) is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="category_exists")
        category.name = payload.name

    if payload.is_active is not None:
        category.is_active = payload.is_active

    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles({UserRole.ADMIN})),
) -> None:
    repo = CategoryRepository(db)
    category = repo.get_or_404(category_id)
    repo.clear_devices_category(category_id)
    db.delete(category)
    db.commit()


@router.post(
    "/{category_id}/subcategories",
    response_model=Subcategory,
    status_code=status.HTTP_201_CREATED,
)
def create_subcategory(
    category_id: UUID,
    payload: SubcategoryCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles({UserRole.ADMIN})),
) -> Subcategory:
    CategoryRepository(db).get_or_404(category_id)

    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="subcategory_name_empty")

    sub = SubcategoryModel(category_id=category_id, name=name)
    db.add(sub)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="subcategory_exists") from exc
    db.refresh(sub)
    return Subcategory.model_validate(sub)


@router.patch("/subcategories/{subcategory_id}", response_model=Subcategory)
def update_subcategory(
    subcategory_id: UUID,
    payload: SubcategoryUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles({UserRole.ADMIN})),
) -> Subcategory:
    sub = SubcategoryRepository(db).get_or_404(subcategory_id)

    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="subcategory_name_empty")
        sub.name = name
    if payload.is_active is not None:
        sub.is_active = payload.is_active

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="subcategory_exists") from exc
    db.refresh(sub)
    return Subcategory.model_validate(sub)


@router.delete("/subcategories/{subcategory_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subcategory(
    subcategory_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles({UserRole.ADMIN})),
) -> None:
    sub_repo = SubcategoryRepository(db)
    sub = sub_repo.get_or_404(subcategory_id)
    sub_repo.clear_devices_subcategory(subcategory_id)
    db.delete(sub)
    db.commit()
