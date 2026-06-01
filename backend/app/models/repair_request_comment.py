from uuid import uuid4

from sqlalchemy import Boolean, Column, ForeignKey, String, Text, Uuid
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.orm import relationship

from backend.app.models.base import Base


class RepairRequestComment(Base):
    __tablename__ = "repair_request_comments"

    id = Column(Uuid, primary_key=True, default=uuid4)
    repair_request_id = Column(Uuid, ForeignKey("repair_requests.id", ondelete="CASCADE"), nullable=False)
    author_user_id = Column(Uuid, ForeignKey("users.id"), nullable=False)
    body = Column(Text, nullable=False)
    tracker_comment_id = Column(String(64), nullable=True)
    tracker_synced = Column(Boolean, nullable=False, default=True, server_default="true")
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())

    repair_request = relationship("RepairRequest", backref="comments")
    author = relationship("User", foreign_keys=[author_user_id])
