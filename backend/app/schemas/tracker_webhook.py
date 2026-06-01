from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator, model_validator


class YandexTrackerWebhookPayload(BaseModel):
    """Тело POST из триггера Yandex Tracker"""

    model_config = ConfigDict(extra="ignore")

    issue_key: str | None = Field(
        default=None, description="Ключ задачи, например FixMyKit-666"
    )
    issue_id: str | None = Field(
        default=None,
        description="Id задачи в Yandex Tracker",
    )
    resolution: str | None = Field(
        default=None,
        description="Резолюция из Трекера ({{issue.resolution}})",
    )
    resolution_desc: str | None = Field(
        default=None,
        validation_alias=AliasChoices("resolution_desc", "resolution_comment"),
        description="Комментарий при переходе ({{userComment.text}})",
    )
    tracker_status: str | None = Field(
        default=None,
        description=(
            "Строка статуса из Tracker (например {{issue.status}}), точное совпадение с ключами "
            "TRACKER_STATUS_ALIASES в backend."
        ),
    )
    user: str | None = Field(
        default=None,
        description=("Кто закрыл в Yandex Tracker"),
    )

    @field_validator("issue_id", mode="before")
    @classmethod
    def issue_id_as_str(cls, v: object) -> str | None:
        if v is None:
            return None
        s = str(v).strip()
        return s or None

    @field_validator("resolution", "resolution_desc", mode="before")
    @classmethod
    def empty_text_as_none(cls, v: object) -> str | None:
        if v is None:
            return None
        s = str(v).strip()
        return s or None

    @model_validator(mode="after")
    def require_issue_ref(self) -> "YandexTrackerWebhookPayload":
        key = (self.issue_key or "").strip()
        iid = (self.issue_id or "").strip()
        if not key and not iid:
            raise ValueError("issue_key or issue_id is required")
        return self


class YandexTrackerSysadminTakenPayload(BaseModel):
    """Тело POST из триггера Yandex Tracker по макросу «забрал / вернул сисадмин»."""

    model_config = ConfigDict(extra="ignore")

    issue_key: str | None = Field(default=None)
    issue_id: str | None = Field(default=None)
    sysadmin_taken: bool = Field(
        description="true — забрал, false — вернул (снять отметку)",
    )
    user: str | None = Field(
        default=None,
        description="Логин из {{currentUser.login}}",
    )

    @field_validator("issue_id", mode="before")
    @classmethod
    def issue_id_as_str(cls, v: object) -> str | None:
        if v is None:
            return None
        s = str(v).strip()
        return s or None

    @model_validator(mode="after")
    def require_issue_ref(self) -> "YandexTrackerSysadminTakenPayload":
        key = (self.issue_key or "").strip()
        iid = (self.issue_id or "").strip()
        if not key and not iid:
            raise ValueError("issue_key or issue_id is required")
        return self


class YandexTrackerPublishPayload(BaseModel):
    """Тело POST из триггера Yandex Tracker по макросу «опубликовать / снять с публикации»."""

    model_config = ConfigDict(extra="ignore")

    issue_key: str | None = Field(default=None)
    issue_id: str | None = Field(default=None)
    is_published: bool = Field(
        description="true — опубликовать для гостей, false — снять с публикации",
    )
    user: str | None = Field(
        default=None,
        description="Логин из {{currentUser.login}}",
    )

    @field_validator("issue_id", mode="before")
    @classmethod
    def issue_id_as_str(cls, v: object) -> str | None:
        if v is None:
            return None
        s = str(v).strip()
        return s or None

    @model_validator(mode="after")
    def require_issue_ref(self) -> "YandexTrackerPublishPayload":
        key = (self.issue_key or "").strip()
        iid = (self.issue_id or "").strip()
        if not key and not iid:
            raise ValueError("issue_key or issue_id is required")
        return self


class YandexTrackerWebhookResponse(BaseModel):
    status: str
    repair_request_id: str | None = None
    detail: str | None = None
    request_status: str | None = Field(
        default=None,
        description="Статус заявки после обработки",
    )
    closed_by_login: str | None = Field(
        default=None, description="Кого записали в closed_by (login), только при closed"
    )
    taken_by_sysadmin: bool | None = Field(
        default=None,
        description="Отметка «забрал сисадмин» после обработки (эндпоинт sysadmin-taken)",
    )
    is_published: bool | None = Field(
        default=None,
        description="Видимость заявки для гостей после обработки",
    )
