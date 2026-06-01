from pydantic import BaseModel, Field


class TrackerAttachmentItem(BaseModel):
    id: str
    name: str
    kind: str = Field(description="image | video")
    mimetype: str | None = None
    size: int | None = None
    has_thumbnail: bool = False
    created_at: str | None = None


class TrackerAttachmentList(BaseModel):
    items: list[TrackerAttachmentItem]


class AttachmentCleanupResponse(BaseModel):
    orphan_dirs_removed: int
    stale_files_removed: int
    empty_dirs_removed: int


class AttachmentLimitsResponse(BaseModel):
    max_per_request: int = Field(description="Максимум файлов на одну заявку")
    max_bytes: int = Field(description="Максимальный размер одного файла в байтах")
