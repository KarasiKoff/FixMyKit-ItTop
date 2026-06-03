from typing import Any, Literal

from pydantic import BaseModel, Field

LogSource = Literal["app", "error"]
LogLevelFilter = Literal["ALL", "INFO", "WARNING", "ERROR", "CRITICAL", "DEBUG"]


class LogEntry(BaseModel):
    ts: str | None = None
    level: str = "INFO"
    logger: str | None = None
    message: str = ""
    request_id: str | None = None
    exception: str | None = None
    extra: dict[str, Any] | None = None
    raw: str | None = None


class AdminLogsResponse(BaseModel):
    source: LogSource
    level_filter: LogLevelFilter
    items: list[LogEntry]
    files: dict[str, Any] = Field(default_factory=dict)
