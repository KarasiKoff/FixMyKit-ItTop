from typing import Literal

from pydantic import BaseModel


class IntegrationPublicResponse(BaseModel):
    provider: Literal["none", "yandex", "jira"]
    enabled: bool
    label: str
