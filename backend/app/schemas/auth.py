from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    login: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginResponse(BaseModel):
    """Ответ логина: JWT в httpOnly cookie, не в теле."""

    token_type: str = "bearer"


class SelfPasswordUpdate(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)
