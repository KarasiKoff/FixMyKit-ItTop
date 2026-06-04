from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.app.repositories.category_repository import SubcategoryRepository


def count_active_subcategories(db: Session, category_id: UUID) -> int:
    return SubcategoryRepository(db).count_active_for_category(category_id)


def validate_device_subcategory(
    db: Session,
    *,
    category_id: UUID | None,
    subcategory_id: UUID | None,
) -> None:
    if subcategory_id is not None and category_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="subcategory_requires_category",
        )

    if subcategory_id is not None:
        sub = SubcategoryRepository(db).get_by_id(subcategory_id)
        if sub is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="subcategory_not_found",
            )
        if sub.category_id != category_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="subcategory_category_mismatch",
            )

    if category_id is not None and count_active_subcategories(db, category_id) > 0 and subcategory_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="subcategory_required",
        )
