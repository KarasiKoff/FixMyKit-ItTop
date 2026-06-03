from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.app.models.subcategory import Subcategory as SubcategoryModel


def count_active_subcategories(db: Session, category_id: UUID) -> int:
    return (
        db.query(SubcategoryModel)
        .filter(
            SubcategoryModel.category_id == category_id,
            SubcategoryModel.is_active.is_(True),
        )
        .count()
    )


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
        sub = db.query(SubcategoryModel).filter(SubcategoryModel.id == subcategory_id).first()
        if sub is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="subcategory_not_found")
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
