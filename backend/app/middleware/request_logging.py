"""HTTP middleware: request_id и логирование запросов."""

from __future__ import annotations

import logging
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from backend.app.core.request_context import (
    new_request_id,
    reset_request_id,
    set_request_id,
)

logger = logging.getLogger("fixmykit.http")

REQUEST_ID_HEADER = "X-Request-ID"


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        incoming = (request.headers.get(REQUEST_ID_HEADER) or "").strip()
        rid = incoming or new_request_id()
        token = set_request_id(rid)

        path = request.url.path
        skip_body_paths = {"/health", "/health/ready", "/metrics"}
        started = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            response.headers[REQUEST_ID_HEADER] = rid
            return response
        except Exception:
            logger.exception(
                "http_request_failed",
                extra={
                    "method": request.method,
                    "path": path,
                    "client": request.client.host if request.client else None,
                },
            )
            raise
        finally:
            elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
            if path not in skip_body_paths:
                level = logging.INFO
                if status_code >= 500:
                    level = logging.ERROR
                elif status_code >= 400:
                    level = logging.WARNING
                logger.log(
                    level,
                    "http_request",
                    extra={
                        "method": request.method,
                        "path": path,
                        "status": status_code,
                        "duration_ms": elapsed_ms,
                        "client": request.client.host if request.client else None,
                    },
                )
            reset_request_id(token)
