from uuid import uuid4

from sqlalchemy import Boolean, Column, LargeBinary, String, Uuid, func
from sqlalchemy.dialects.postgresql import TIMESTAMP

from backend.app.models.base import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Uuid, primary_key=True, default=uuid4)
    name = Column(String, nullable=False, unique=True)
    is_active = Column(Boolean, default=True, nullable=False)
    icon_mime = Column(String(128), nullable=True)
    icon_data = Column(LargeBinary, nullable=True)
    created_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    @property
    def has_icon(self) -> bool:
        return self.icon_mime is not None
