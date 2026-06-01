from pydantic import BaseModel, ConfigDict


class AudienceBase(BaseModel):
    name: str


class AudienceCreate(BaseModel):
    name: str


class AudienceUpdate(BaseModel):
    name: str | None = None


class Audience(AudienceBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class AudienceList(BaseModel):
    items: list[Audience]
