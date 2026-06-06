"""Общие настройки pytest: переменные окружения для тестов."""

from __future__ import annotations

import os

# До импорта backend.app.core.config
os.environ.setdefault(
    "POSTGRES_HOST", os.environ.get("TEST_POSTGRES_HOST", "localhost")
)
os.environ.setdefault("POSTGRES_PORT", os.environ.get("TEST_POSTGRES_PORT", "5432"))
os.environ.setdefault(
    "POSTGRES_DB", os.environ.get("TEST_POSTGRES_DB", "fixmykit_test")
)
os.environ.setdefault("POSTGRES_USER", os.environ.get("TEST_POSTGRES_USER", "fixmykit"))
os.environ.setdefault(
    "POSTGRES_PASSWORD", os.environ.get("TEST_POSTGRES_PASSWORD", "fixmykit")
)
os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret-key")
os.environ.setdefault("TRACKER_WEBHOOK_SECRET", "test-webhook-secret")
os.environ.setdefault("TRACKER_WEBHOOK_ACTOR_LOGIN", "tracker_webhook")
os.environ.setdefault("API_DOCS_ENABLED", "false")
os.environ.setdefault(
    "UPLOAD_DIR", os.path.join(os.environ.get("TEMP", "/tmp"), "fixmykit-test-uploads")
)
os.environ.setdefault("REALTIME_BACKEND", "memory")
os.environ.setdefault("REDIS_URL", "")
