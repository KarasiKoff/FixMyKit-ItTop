"""Тела POST из Jira Automation → Fix My Kit."""

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from backend.app.schemas.tracker_webhook import YandexTrackerWebhookResponse

JiraWebhookResponse = YandexTrackerWebhookResponse


class JiraWebhookStatusPayload(BaseModel):
    """Смена статуса задачи Jira."""

    model_config = ConfigDict(extra="ignore")

    issue_key: str | None = Field(default=None, description="Ключ задачи, например FMK-42")
    issue_id: str | None = Field(default=None, description="Numeric id задачи в Jira")
    jira_status: str | None = Field(
        default=None,
        validation_alias=AliasChoices("jira_status", "status", "issue_status", "tracker_status"),
        description="Имя статуса Jira ({{issue.status.name}}), ключ JIRA_STATUS_MAP",
    )
    resolution: str | None = Field(
        default=None,
        description="Резолюция ({{issue.resolution.name}})",
    )
    resolution_desc: str | None = Field(
        default=None,
        validation_alias=AliasChoices("resolution_desc", "resolution_comment"),
    )
    user: str | None = Field(
        default=None,
        description="Email или логин инициатора ({{initiator.emailAddress}})",
    )

    @field_validator("issue_id", mode="before")
    @classmethod
    def issue_id_as_str(cls, v: object) -> str | None:
        if v is None:
            return None
        s = str(v).strip()
        return s or None

    @field_validator("resolution", "resolution_desc", "jira_status", mode="before")
    @classmethod
    def empty_text_as_none(cls, v: object) -> str | None:
        if v is None:
            return None
        s = str(v).strip()
        return s or None

    @model_validator(mode="after")
    def require_issue_ref(self) -> "JiraWebhookStatusPayload":
        key = (self.issue_key or "").strip()
        iid = (self.issue_id or "").strip()
        if not key and not iid:
            raise ValueError("issue_key or issue_id is required")
        return self


class JiraWebhookCommentPayload(BaseModel):
    """Комментарий к задаче Jira → лента на сайте."""

    model_config = ConfigDict(extra="ignore")

    issue_key: str | None = Field(default=None)
    issue_id: str | None = Field(default=None)
    comment_id: str | None = Field(
        default=None,
        description="Id комментария Jira — идемпотентность",
    )
    comment_text: str | None = Field(
        default=None,
        validation_alias=AliasChoices("comment_text", "comment", "text", "body"),
    )
    user: str | None = Field(default=None, description="Email автора")
    author: str | None = Field(default=None, description="Отображаемое имя автора")

    @field_validator("issue_id", "comment_id", mode="before")
    @classmethod
    def id_as_str(cls, v: object) -> str | None:
        if v is None:
            return None
        s = str(v).strip()
        return s or None

    @field_validator("comment_text", "user", "author", mode="before")
    @classmethod
    def empty_text_as_none(cls, v: object) -> str | None:
        if v is None:
            return None
        s = str(v).strip()
        return s or None

    @model_validator(mode="after")
    def require_issue_ref(self) -> "JiraWebhookCommentPayload":
        key = (self.issue_key or "").strip()
        iid = (self.issue_id or "").strip()
        if not key and not iid:
            raise ValueError("issue_key or issue_id is required")
        return self
