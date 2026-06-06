from pydantic import BaseModel, Field


class SseTicketResponse(BaseModel):
    sse_token: str = Field(
        description="Короткоживущий токен для query-параметра sse_token"
    )
    expires_in: int = Field(description="TTL в секундах")
