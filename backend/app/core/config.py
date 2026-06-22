from pathlib import Path

from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[3]
BACKEND_DIR = Path(__file__).resolve().parents[2]


class ServerConfig(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(ROOT_DIR / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = Field(default="Fix My Kit API", alias="APP_NAME")
    api_host: str = Field(default="0.0.0.0", alias="API_HOST")
    api_port: int = Field(default=8000, alias="API_PORT")
    api_docs_enabled: bool = Field(
        default=True,
        alias="API_DOCS_ENABLED",
        description="Swagger (/docs), ReDoc (/redoc), OpenAPI JSON (/openapi.json)",
    )
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    log_dir: str = Field(
        default="data/logs",
        alias="LOG_DIR",
        description="Каталог ротируемых логов (fixmykit.log, fixmykit-error.log).",
    )
    log_max_bytes: int = Field(
        default=10 * 1024 * 1024,
        alias="LOG_MAX_BYTES",
        description="Макс. размер одного файла лога до ротации.",
    )
    log_backup_count: int = Field(
        default=10,
        alias="LOG_BACKUP_COUNT",
        description="Число архивных файлов при ротации.",
    )
    log_json: bool = Field(
        default=True,
        alias="LOG_JSON",
        description="JSON-строки в логах (иначе текст в консоли).",
    )
    jwt_secret_key: str = Field(default="change_me_secret", alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(
        default=60, alias="ACCESS_TOKEN_EXPIRE_MINUTES"
    )
    admin_login: str | None = Field(default=None, alias="ADMIN_LOGIN")
    admin_password: str | None = Field(default=None, alias="ADMIN_PASSWORD")

    tracker_base_url: str = Field(
        default="https://api.tracker.yandex.net/v3",
        alias="TRACKER_BASE_URL",
    )
    tracker_token: str | None = Field(default=None, alias="TRACKER_TOKEN")
    tracker_org_id: str | None = Field(default=None, alias="TRACKER_ORG_ID")
    tracker_queue: str | None = Field(default=None, alias="TRACKER_QUEUE")
    tracker_timeout_seconds: int = Field(default=15, alias="TRACKER_TIMEOUT_SECONDS")
    tracker_attachment_timeout_seconds: int = Field(
        default=600,
        alias="TRACKER_ATTACHMENT_TIMEOUT_SECONDS",
        description="Таймаут HTTP при загрузке вложений в Tracker (большие файлы).",
    )
    tracker_webhook_secret: str | None = Field(
        default=None,
        alias="TRACKER_WEBHOOK_SECRET",
        description="Секрет для POST /api/webhooks/yandex-tracker (заголовок X-Tracker-Webhook-Secret).",
    )
    tracker_webhook_actor_login: str = Field(
        default="tracker_webhook",
        alias="TRACKER_WEBHOOK_ACTOR_LOGIN",
        description="Логин технического пользователя",
    )
    issue_tracker: str = Field(
        default="auto",
        alias="ISSUE_TRACKER",
        description=(
            "auto | none | yandex | jira. "
            "auto: jira при настроенных JIRA_*; иначе yandex при TRACKER_TOKEN; иначе none."
        ),
    )
    jira_base_url: str | None = Field(
        default=None,
        alias="JIRA_BASE_URL",
        description="URL сайта Jira (https://org.atlassian.net) — ссылки browse/KEY.",
    )
    jira_cloud_id: str | None = Field(
        default=None,
        alias="JIRA_CLOUD_ID",
        description="Cloud ID для API сервисного аккаунта (api.atlassian.com/ex/jira/{id}).",
    )
    jira_auth_mode: str = Field(
        default="auto",
        alias="JIRA_AUTH_MODE",
        description="auto | service_account | site. auto: service_account при JIRA_CLOUD_ID.",
    )
    jira_service_account_email: str | None = Field(
        default=None,
        alias="JIRA_SERVICE_ACCOUNT_EMAIL",
        description="Email сервисного аккаунта (legacy site mode; Bearer-token — не обязателен).",
    )
    jira_email: str | None = Field(
        default=None,
        alias="JIRA_EMAIL",
        description="Устаревший alias для JIRA_SERVICE_ACCOUNT_EMAIL.",
    )
    jira_api_token: str | None = Field(default=None, alias="JIRA_API_TOKEN")
    jira_project_key: str | None = Field(default=None, alias="JIRA_PROJECT_KEY")
    jira_issue_type: str = Field(
        default="Task",
        alias="JIRA_ISSUE_TYPE",
        description="Имя типа задачи (локаль Jira). Если не найден — JIRA_ISSUE_TYPE_ID или createmeta.",
    )
    jira_issue_type_id: str | None = Field(
        default=None,
        alias="JIRA_ISSUE_TYPE_ID",
        description="Numeric id типа задачи (надёжнее имени, см. createmeta).",
    )
    jira_issue_label: str = Field(
        default="fmk",
        alias="JIRA_ISSUE_LABEL",
        description="Метка(и) Jira при создании задачи (через запятую).",
    )
    jira_timeout_seconds: int = Field(default=15, alias="JIRA_TIMEOUT_SECONDS")
    jira_attachment_timeout_seconds: int = Field(
        default=600,
        alias="JIRA_ATTACHMENT_TIMEOUT_SECONDS",
    )
    jira_webhook_secret: str | None = Field(default=None, alias="JIRA_WEBHOOK_SECRET")
    jira_status_map_json: str = Field(
        default="{}",
        alias="JIRA_STATUS_MAP",
        description='JSON: {"To Do":"open",...} для входящих вебхуков (фаза C).',
    )
    jira_transition_open: str | None = Field(default=None, alias="JIRA_TRANSITION_OPEN")
    jira_transition_in_progress: str | None = Field(
        default=None, alias="JIRA_TRANSITION_IN_PROGRESS"
    )
    jira_transition_needs_info: str | None = Field(
        default=None, alias="JIRA_TRANSITION_NEEDS_INFO"
    )
    jira_transition_closed: str | None = Field(
        default=None, alias="JIRA_TRANSITION_CLOSED"
    )
    public_frontend_base_url: str = Field(
        default="https://fixmykit.local",
        alias="PUBLIC_FRONTEND_BASE_URL",
        description="Базовый URL фронта для QR (публичная страница устройства /device/{id}/public).",
    )
    clck_shortener_enabled: bool = Field(
        default=True,
        alias="CLCK_SHORTENER_ENABLED",
        description="Сокращать ссылки для QR через clck.ru (POST /api/public/shorten-url).",
    )
    cors_origins: str = Field(
        default="",
        alias="CORS_ORIGINS",
        description="Разрешённые Origin для CORS, через запятую. Пусто — middleware CORS не подключается.",
    )
    upload_dir: str = Field(
        default="data/uploads",
        alias="UPLOAD_DIR",
        description="Каталог временных вложений заявок (pending) до загрузки в Tracker.",
    )
    attachment_max_bytes: int = Field(
        default=1024 * 1024 * 1024,
        alias="ATTACHMENT_MAX_BYTES",
        description="Максимальный размер одного файла (байты).",
    )
    attachment_max_per_request: int = Field(
        default=10,
        alias="ATTACHMENT_MAX_PER_REQUEST",
    )
    attachment_orphan_max_age_days: int = Field(
        default=30,
        alias="ATTACHMENT_ORPHAN_MAX_AGE_DAYS",
    )
    redis_url: str = Field(
        default="",
        alias="REDIS_URL",
        description="Redis для SSE-тикетов и pub/sub (пусто — in-memory, только один воркер).",
    )
    realtime_backend: str = Field(
        default="auto",
        alias="REALTIME_BACKEND",
        description="auto | redis | memory. auto: redis при заданном REDIS_URL, иначе memory.",
    )
    redis_sse_channel: str = Field(
        default="fixmykit:sse",
        alias="REDIS_SSE_CHANNEL",
    )
    sse_ticket_ttl_seconds: int = Field(
        default=300,
        alias="SSE_TICKET_TTL_SECONDS",
        description="TTL одноразового SSE-токена; продлевается при подключении к /stream.",
    )
    auth_cookie_name: str = Field(default="fmk_access_token", alias="AUTH_COOKIE_NAME")
    auth_cookie_secure: bool = Field(
        default=False,
        alias="AUTH_COOKIE_SECURE",
        description="Secure cookie (true на HTTPS в prod).",
    )
    auth_cookie_samesite: str = Field(
        default="lax",
        alias="AUTH_COOKIE_SAMESITE",
        description="lax | strict | none (none для app+api на разных поддоменах).",
    )
    auth_cookie_domain: str = Field(
        default="",
        alias="AUTH_COOKIE_DOMAIN",
        description="Например .fixmykit.example.com для api+app; пусто — хост API.",
    )

    def resolved_realtime_backend(self) -> str:
        mode = (self.realtime_backend or "auto").strip().lower()
        if mode == "auto":
            return "redis" if (self.redis_url or "").strip() else "memory"
        if mode in ("redis", "memory"):
            return mode
        return "memory"

    def jira_credentials_ready(self) -> bool:
        if not (self.jira_api_token or "").strip():
            return False
        if not (self.jira_project_key or "").strip():
            return False
        if self.resolved_jira_auth_mode() == "service_account":
            return bool((self.jira_cloud_id or "").strip()) and bool(
                (self.jira_base_url or "").strip()
            )
        if not (self.jira_base_url or "").strip():
            return False
        account = (self.jira_service_account_email or self.jira_email or "").strip()
        return bool(account)

    def resolved_issue_tracker(self) -> str:
        mode = (self.issue_tracker or "auto").strip().lower()
        if mode == "auto":
            if self.jira_credentials_ready():
                return "jira"
            if (self.tracker_token or "").strip():
                return "yandex"
            return "none"
        if mode in ("none", "yandex", "jira"):
            return mode
        return "none"

    def external_tracker_enabled(self) -> bool:
        return self.resolved_issue_tracker() != "none"

    def external_tracker_label(self) -> str:
        match self.resolved_issue_tracker():
            case "jira":
                return "Jira"
            case "yandex":
                return "Yandex Tracker"
            case _:
                return ""

    def resolved_jira_auth_mode(self) -> str:
        mode = (self.jira_auth_mode or "auto").strip().lower()
        if mode == "auto":
            if (self.jira_cloud_id or "").strip():
                return "service_account"
            return "site"
        if mode in ("service_account", "site"):
            return mode
        return "site"


class DbConfig(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(ROOT_DIR / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    postgres_host: str = Field(default="localhost", alias="POSTGRES_HOST")
    postgres_port: int = Field(default=5432, alias="POSTGRES_PORT")
    postgres_db: str = Field(alias="POSTGRES_DB")
    postgres_user: str = Field(alias="POSTGRES_USER")
    postgres_password: str = Field(alias="POSTGRES_PASSWORD")

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


class Settings(BaseModel):
    server: ServerConfig = Field(default_factory=ServerConfig)
    database: DbConfig = Field(default_factory=DbConfig)


settings = Settings()
