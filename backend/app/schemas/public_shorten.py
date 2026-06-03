from pydantic import BaseModel, Field


class ShortenUrlRequest(BaseModel):
    url: str = Field(..., min_length=8, max_length=2048)


class ShortenUrlResponse(BaseModel):
    url: str
    short_url: str
