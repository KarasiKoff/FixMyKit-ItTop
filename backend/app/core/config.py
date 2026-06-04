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

    @property
    def app_name(self) -> str:
        return self.server.app_name

    @property
    def api_host(self) -> str:
        return self.server.api_host

    @property
    def api_port(self) -> int:
        return self.server.api_port

    @property
    def log_level(self) -> str:
        return self.server.log_level

    @property
    def jwt_secret_key(self) -> str:
        return self.server.jwt_secret_key

    @property
    def jwt_algorithm(self) -> str:
        return self.server.jwt_algorithm

    @property
    def access_token_expire_minutes(self) -> int:
        return self.server.access_token_expire_minutes

    @property
    def admin_login(self) -> str | None:
        return self.server.admin_login

    @property
    def admin_password(self) -> str | None:
        return self.server.admin_password

    @property
    def database_url(self) -> str:
        return self.database.database_url

    @property
    def tracker_base_url(self) -> str:
        return self.server.tracker_base_url

    @property
    def tracker_token(self) -> str | None:
        return self.server.tracker_token

    @property
    def tracker_org_id(self) -> str | None:
        return self.server.tracker_org_id

    @property
    def tracker_queue(self) -> str | None:
        return self.server.tracker_queue

    @property
    def tracker_timeout_seconds(self) -> int:
        return self.server.tracker_timeout_seconds

    @property
    def tracker_attachment_timeout_seconds(self) -> int:
        return self.server.tracker_attachment_timeout_seconds

    @property
    def tracker_webhook_secret(self) -> str | None:
        return self.server.tracker_webhook_secret

    @property
    def tracker_webhook_actor_login(self) -> str:
        return self.server.tracker_webhook_actor_login

    @property
    def upload_dir(self) -> str:
        return self.server.upload_dir

    @property
    def attachment_max_bytes(self) -> int:
        return self.server.attachment_max_bytes

    @property
    def attachment_max_per_request(self) -> int:
        return self.server.attachment_max_per_request

    @property
    def attachment_orphan_max_age_days(self) -> int:
        return self.server.attachment_orphan_max_age_days

    @property
    def public_frontend_base_url(self) -> str:
        return self.server.public_frontend_base_url

    @property
    def clck_shortener_enabled(self) -> bool:
        return self.server.clck_shortener_enabled

    @property
    def log_dir(self) -> str:
        return self.server.log_dir


settings = Settings()
