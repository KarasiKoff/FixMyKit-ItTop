"""Операции категорий/подкатегорий для HTTP-слоя."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.repositories.category_repository import (
    CategoryRepository,
    SubcategoryRepository,
)
from backend.app.schemas.category import (
    Category,
    CategoryCreate,
    CategoryList,
    CategoryUpdate,
    CategoryWithSubcategories,
)
from backend.app.schemas.subcategory import (
    Subcategory,
    SubcategoryCreate,
    SubcategoryUpdate,
)
from backend.app.services.category_icon_service import validate_and_prepare_icon


def list_categories(db: Session, *, is_active: bool | None) -> CategoryList:
    items = CategoryRepository(db).list_all(is_active=is_active)
    return CategoryList(
        items=[CategoryWithSubcategories.model_validate(item) for item in items]
    )


def category_icon_response(db: Session, category_id: UUID) -> Response:
    category = CategoryRepository(db).get_or_404(category_id)
    if not category.icon_mime or not category.icon_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="icon_not_found"
        )
    return Response(
        content=bytes(category.icon_data),
        media_type=category.icon_mime,
        headers={"Cache-Control": "public, max-age=3600"},
    )


async def upload_category_icon(
    db: Session, category_id: UUID, file: UploadFile
) -> Category:
    category = CategoryRepository(db).get_or_404(category_id)
    raw = await file.read()
    try:
        mime, data = validate_and_prepare_icon(raw)
    except ValueError as e:
        code = str(e)
        if code == "icon_too_large":
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=code
            )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=code
        )

    category.icon_mime = mime
    category.icon_data = data
    db.commit()
    db.refresh(category)
    return category


def delete_category_icon(db: Session, category_id: UUID) -> Category:
    category = CategoryRepository(db).get_or_404(category_id)
    category.icon_mime = None
    category.icon_data = None
    db.commit()
    db.refresh(category)
    return category


def create_category(db: Session, payload: CategoryCreate) -> Category:
    repo = CategoryRepository(db)
    if repo.get_by_name(payload.name) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="category_exists"
        )
    return repo.create(payload.name)


def update_category(
    db: Session, category_id: UUID, payload: CategoryUpdate
) -> Category:
    repo = CategoryRepository(db)
    category = repo.get_or_404(category_id)

    if payload.name is not None and payload.name != category.name:
        if repo.get_by_name(payload.name) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="category_exists"
            )
        category.name = payload.name

    if payload.is_active is not None:
        category.is_active = payload.is_active

    db.commit()
    db.refresh(category)
    return category


def delete_category(db: Session, category_id: UUID) -> None:
    repo = CategoryRepository(db)
    category = repo.get_or_404(category_id)
    repo.clear_devices_category(category_id)
    repo.delete(category)


def create_subcategory(
    db: Session, category_id: UUID, payload: SubcategoryCreate
) -> Subcategory:
    CategoryRepository(db).get_or_404(category_id)
    name = payload.name.strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="subcategory_name_empty",
        )
    try:
        sub = SubcategoryRepository(db).create(category_id, name)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="subcategory_exists"
        ) from exc
    return Subcategory.model_validate(sub)


def update_subcategory(
    db: Session, subcategory_id: UUID, payload: SubcategoryUpdate
) -> Subcategory:
    sub = SubcategoryRepository(db).get_or_404(subcategory_id)

    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="subcategory_name_empty",
            )
        sub.name = name
    if payload.is_active is not None:
        sub.is_active = payload.is_active

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="subcategory_exists"
        ) from exc
    db.refresh(sub)
    return Subcategory.model_validate(sub)


def delete_subcategory(db: Session, subcategory_id: UUID) -> None:
    sub_repo = SubcategoryRepository(db)
    sub = sub_repo.get_or_404(subcategory_id)
    sub_repo.clear_devices_subcategory(subcategory_id)
    sub_repo.delete(sub)
