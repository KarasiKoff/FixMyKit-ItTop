"""Настройка логирования: консоль + ротируемые файлы, структурированные записи."""

from __future__ import annotations

import json
import logging
import logging.config
import sys
from datetime import UTC, datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any

from backend.app.core.request_context import get_request_id


class RequestContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_request_id() or "-"
        return True


class JsonLineFormatter(logging.Formatter):
    """Одна строка JSON на запись — удобно для grep и UI логов."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", "-"),
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        for key, value in record.__dict__.items():
            if key.startswith("_") or key in {
                "name",
                "msg",
                "args",
                "created",
                "filename",
                "funcName",
                "levelname",
                "levelno",
                "lineno",
                "module",
                "msecs",
                "message",
                "pathname",
                "process",
                "processName",
                "relativeCreated",
                "stack_info",
                "exc_info",
                "exc_text",
                "thread",
                "threadName",
                "taskName",
                "request_id",
            }:
                continue
            if isinstance(value, (str, int, float, bool)) or value is None:
                payload[key] = value
        return json.dumps(payload, ensure_ascii=False)


class ConsoleFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        rid = getattr(record, "request_id", "-")
        base = super().format(record)
        return f"[{rid}] {base}"


def _level(name: str) -> int:
    return getattr(logging, name.upper(), logging.INFO)


def setup_logging(
    *,
    log_level: str = "INFO",
    log_dir: str = "data/logs",
    log_max_bytes: int = 10 * 1024 * 1024,
    log_backup_count: int = 10,
    log_json: bool = True,
) -> Path:
    """Инициализация логов один раз при старте приложения."""
    root = logging.getLogger()
    if getattr(root, "_fixmykit_logging_configured", False):
        return Path(log_dir)

    level = _level(log_level)
    log_path = Path(log_dir)
    log_path.mkdir(parents=True, exist_ok=True)

    fmt = JsonLineFormatter() if log_json else ConsoleFormatter(
        "%(asctime)s %(levelname)s %(name)s: %(message)s"
    )
    ctx_filter = RequestContextFilter()

    console = logging.StreamHandler(sys.stdout)
    console.setLevel(level)
    console.addFilter(ctx_filter)
    console.setFormatter(
        fmt if log_json else ConsoleFormatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
    )

    app_file = RotatingFileHandler(
        log_path / "fixmykit.log",
        maxBytes=log_max_bytes,
        backupCount=log_backup_count,
        encoding="utf-8",
    )
    app_file.setLevel(logging.INFO)
    app_file.addFilter(ctx_filter)
    app_file.setFormatter(fmt)

    error_file = RotatingFileHandler(
        log_path / "fixmykit-error.log",
        maxBytes=log_max_bytes,
        backupCount=log_backup_count,
        encoding="utf-8",
    )
    error_file.setLevel(logging.ERROR)
    error_file.addFilter(ctx_filter)
    error_file.setFormatter(fmt)

    root.setLevel(level)
    root.handlers.clear()
    root.addHandler(console)
    root.addHandler(app_file)
    root.addHandler(error_file)

    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

    root._fixmykit_logging_configured = True  # type: ignore[attr-defined]

    logging.getLogger(__name__).info(
        "logging_initialized",
        extra={
            "log_dir": str(log_path.resolve()),
            "log_level": logging.getLevelName(level),
            "log_json": log_json,
        },
    )
    return log_path
