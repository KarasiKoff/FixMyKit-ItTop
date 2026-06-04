"""Доступ к категориям и подкатегориям устройств в БД."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Query, Session, defer, joinedload

from backend.app.models.category import Category
from backend.app.models.device import Device
from backend.app.models.subcategory import Subcategory


class CategoryRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def list_query(self, *, is_active: bool | None = None) -> Query[Category]:
        query = self._db.query(Category).options(
            defer(Category.icon_data),
            joinedload(Category.subcategories),
        )
        if is_active is not None:
            query = query.filter(Category.is_active == is_active)
        return query.order_by(Category.created_at.desc())

    def list_all(self, *, is_active: bool | None = None) -> list[Category]:
        return self.list_query(is_active=is_active).all()

    def get_by_id(self, category_id: UUID) -> Category | None:
        return self._db.query(Category).filter(Category.id == category_id).first()

    def get_by_name(self, name: str) -> Category | None:
        return self._db.query(Category).filter(Category.name == name).first()

    def exists(self, category_id: UUID) -> bool:
        return (
            self._db.query(Category.id).filter(Category.id == category_id).first() is not None
        )

    def get_or_404(self, category_id: UUID) -> Category:
        category = self.get_by_id(category_id)
        if category is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="category_not_found",
            )
        return category

    def clear_devices_category(self, category_id: UUID) -> None:
        self._db.query(Device).filter(Device.category_id == category_id).update(
            {Device.category_id: None, Device.subcategory_id: None},
            synchronize_session=False,
        )

    def count(self) -> int:
        return int(self._db.query(Category).count())

    def create(self, name: str) -> Category:
        category = Category(name=name)
        self._db.add(category)
        self._db.commit()
        self._db.refresh(category)
        return category

    def delete(self, category: Category) -> None:
        self._db.delete(category)
        self._db.commit()


class SubcategoryRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def get_by_id(self, subcategory_id: UUID) -> Subcategory | None:
        return (
            self._db.query(Subcategory).filter(Subcategory.id == subcategory_id).first()
        )

    def get_or_404(self, subcategory_id: UUID) -> Subcategory:
        sub = self.get_by_id(subcategory_id)
        if sub is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="subcategory_not_found",
            )
        return sub

    def count_active_for_category(self, category_id: UUID) -> int:
        return (
            self._db.query(Subcategory)
            .filter(
                Subcategory.category_id == category_id,
                Subcategory.is_active.is_(True),
            )
            .count()
        )

    def clear_devices_subcategory(self, subcategory_id: UUID) -> None:
        self._db.query(Device).filter(Device.subcategory_id == subcategory_id).update(
            {Device.subcategory_id: None},
            synchronize_session=False,
        )

    def create(self, category_id: UUID, name: str) -> Subcategory:
        sub = Subcategory(category_id=category_id, name=name)
        self._db.add(sub)
        try:
            self._db.commit()
        except IntegrityError:
            self._db.rollback()
            raise
        self._db.refresh(sub)
        return sub

    def delete(self, sub: Subcategory) -> None:
        self._db.delete(sub)
        self._db.commit()
