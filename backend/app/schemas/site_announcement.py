from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from backend.app.models.enums import AnnouncementAudience, AnnouncementSeverity

SLOT_MIN = 1
SLOT_MAX = 2
MESSAGE_MAX = 500
EMOJI_MAX = 16


class SiteAnnouncementSlot(BaseModel):
    slot: int = Field(..., ge=SLOT_MIN, le=SLOT_MAX)
    is_enabled: bool = False
    message: str = Field(default="", max_length=MESSAGE_MAX)
    audience: AnnouncementAudience = AnnouncementAudience.ALL
    severity: AnnouncementSeverity = AnnouncementSeverity.INFO
    link_url: str | None = Field(default=None, max_length=500)
    emoji: str | None = Field(default=None, max_length=EMOJI_MAX)
    starts_at: datetime | None = None
    ends_at: datetime | None = None

    @field_validator("message")
    @classmethod
    def strip_message(cls, value: str) -> str:
        return value.strip()

    @field_validator("emoji")
    @classmethod
    def normalize_emoji(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None

    @field_validator("link_url")
    @classmethod
    def normalize_link(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        if not trimmed:
            return None
        if not trimmed.startswith(("http://", "https://")):
            raise ValueError("link_url_must_be_http")
        return trimmed

    @model_validator(mode="after")
    def validate_slot(self) -> "SiteAnnouncementSlot":
        if self.is_enabled and not self.message:
            raise ValueError("enabled_requires_message")
        if self.starts_at and self.ends_at and self.starts_at > self.ends_at:
            raise ValueError("starts_after_ends")
        return self


class SiteAnnouncementSlotAdmin(SiteAnnouncementSlot):
    updated_at: datetime | None = None
    updated_by_login: str | None = None
    active_now: bool = False
    dismiss_version: int = 1


class SiteAnnouncementSlotPublic(BaseModel):
    slot: int
    message: str
    severity: AnnouncementSeverity
    audience: AnnouncementAudience
    link_url: str | None = None
    emoji: str | None = None
    dismiss_version: int = 1


class ActiveAnnouncementsResponse(BaseModel):
    items: list[SiteAnnouncementSlotPublic]


class AdminAnnouncementsResponse(BaseModel):
    slots: list[SiteAnnouncementSlotAdmin]


class AdminAnnouncementsUpdateRequest(BaseModel):
    slots: list[SiteAnnouncementSlot]

    @field_validator("slots")
    @classmethod
    def validate_slots(
        cls, slots: list[SiteAnnouncementSlot]
    ) -> list[SiteAnnouncementSlot]:
        seen = {s.slot for s in slots}
        if len(seen) != len(slots):
            raise ValueError("duplicate_slot")
        for slot in seen:
            if slot < SLOT_MIN or slot > SLOT_MAX:
                raise ValueError("invalid_slot")
        return slots


class ResetDismissalsResponse(BaseModel):
    dismiss_version: int
