from sqlalchemy import Column, Integer, String

from backend.app.models.base import Base


class Audience(Base):
    __tablename__ = "audience"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True)
    map_grid_cols = Column(Integer, nullable=False, default=4)
    map_grid_rows = Column(Integer, nullable=False, default=4)
    map_door_edge = Column(String(8), nullable=False, default="bottom")
