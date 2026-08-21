from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class RepairRequestCommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=10000)


class RepairRequestCommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    repair_request_id: UUID
    author_user_id: UUID
    author_login: str | None = None
    author_display_name: str | None = None
    tracker_author_unlinked: bool = Field(
        default=False,
        description="Автор из Jira/Tracker не сопоставлен с учёткой Fix My Kit.",
    )
    body: str
    tracker_synced: bool
    created_at: datetime


class RepairRequestCommentList(BaseModel):
    items: list[RepairRequestCommentResponse]
