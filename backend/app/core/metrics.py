"""Экспорт HTTP-метрик Prometheus для FastAPI."""

from __future__ import annotations

from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator

_METRICS_PATHS = ("/metrics", "/health", "/health/ready")


def setup_metrics(app: FastAPI) -> None:
    Instrumentator(
        should_group_status_codes=True,
        should_ignore_untemplated=True,
        excluded_handlers=list(_METRICS_PATHS),
    ).instrument(app).expose(
        app,
        endpoint="/metrics",
        include_in_schema=False,
    )
