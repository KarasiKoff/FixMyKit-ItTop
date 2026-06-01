from uuid import uuid4

from sqlalchemy import Column, Enum as SQLEnum
from sqlalchemy import ForeignKey, Integer, String, Uuid
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.orm import relationship

from backend.app.models.base import Base
from backend.app.models.enums import RepairStatus


class Device(Base):
    __tablename__ = "devices"

    id = Column(Uuid, primary_key=True, default=uuid4)
    inventory_number = Column(String, nullable=False, unique=True)
    name = Column(String, nullable=False)
    category_id = Column(Uuid, ForeignKey("categories.id"), nullable=True)
    serial_number = Column(String, nullable=True)
    audience_id = Column(Integer, ForeignKey("audience.id"), nullable=True)
    responsible_id = Column(Uuid, ForeignKey("users.id"), nullable=True)
    repair_status = Column(SQLEnum(RepairStatus, name="repair_status"), nullable=False, default=RepairStatus.NOT_IN_REPAIR)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    audience = relationship("Audience", backref="devices")
    category = relationship("Category", backref="devices")
    responsible = relationship("User", foreign_keys=[responsible_id], backref="responsible_for_devices")
