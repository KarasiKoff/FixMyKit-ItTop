from sqlalchemy import Column, Float, ForeignKey, Integer, UniqueConstraint, Uuid

from backend.app.models.base import Base


class RoomDevicePosition(Base):
    __tablename__ = "room_device_positions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    audience_id = Column(Integer, ForeignKey("audience.id", ondelete="CASCADE"), nullable=False)
    device_id = Column(Uuid, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    x_pct = Column(Float, nullable=False)
    y_pct = Column(Float, nullable=False)
    grid_col = Column(Integer, nullable=True)
    grid_row = Column(Integer, nullable=True)

    __table_args__ = (
        UniqueConstraint("audience_id", "device_id", name="uq_room_device_position"),
    )
