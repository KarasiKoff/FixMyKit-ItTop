from uuid import uuid4

from sqlalchemy import Boolean, Column, ForeignKey, String, Uuid, func
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.orm import relationship

from backend.app.models.base import Base


class Subcategory(Base):
    __tablename__ = "subcategories"

    id = Column(Uuid, primary_key=True, default=uuid4)
    category_id = Column(Uuid, ForeignKey("categories.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    category = relationship("Category", back_populates="subcategories")
