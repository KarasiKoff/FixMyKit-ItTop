from pydantic import BaseModel


class SuggestResponse(BaseModel):
    items: list[str]
