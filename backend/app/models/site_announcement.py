from sqlalchemy import (
    Boolean,
    Column,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Uuid,
)
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.orm import relationship

from backend.app.models.base import Base
from backend.app.models.enums import (
    AnnouncementAudience,
    AnnouncementSeverity,
    pg_enum_values,
)


class SiteAnnouncement(Base):
    """Фиксированный слот (1 или 2) для плашки на сайте"""

    __tablename__ = "site_announcements"

    slot = Column(SmallInteger, primary_key=True)
    is_enabled = Column(Boolean, nullable=False, default=False, server_default="false")
    message = Column(String(500), nullable=False, default="", server_default="")
    audience = Column(
        SQLEnum(
            AnnouncementAudience,
            name="announcement_audience",
            values_callable=pg_enum_values,
        ),
        nullable=False,
        default=AnnouncementAudience.ALL,
        server_default=AnnouncementAudience.ALL.value,
    )
    severity = Column(
        SQLEnum(
            AnnouncementSeverity,
            name="announcement_severity",
            values_callable=pg_enum_values,
        ),
        nullable=False,
        default=AnnouncementSeverity.INFO,
        server_default=AnnouncementSeverity.INFO.value,
    )
    link_url = Column(String(500), nullable=True)
    emoji = Column(String(16), nullable=True)
    starts_at = Column(TIMESTAMP(timezone=True), nullable=True)
    ends_at = Column(TIMESTAMP(timezone=True), nullable=True)
    dismiss_version = Column(Integer, nullable=False, default=1, server_default="1")
    updated_by_user_id = Column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    updated_by = relationship("User", foreign_keys=[updated_by_user_id])
