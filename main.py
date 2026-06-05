import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from backend.app.core.config import settings
from backend.app.core.logging_config import setup_logging
from backend.app.core.metrics import setup_metrics

from backend.app.api.router import api_router
from backend.app.middleware.request_logging import RequestLoggingMiddleware
from backend.app.services.admin_bootstrap import ensure_admin_user
from backend.app.services.realtime_hub import bind_main_event_loop, clear_main_event_loop
from backend.app.services.tracker_webhook_bootstrap import ensure_tracker_webhook_actor
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

setup_logging(
    log_level=settings.server.log_level,
    log_dir=settings.server.log_dir,
    log_max_bytes=settings.server.log_max_bytes,
    log_backup_count=settings.server.log_backup_count,
    log_json=settings.server.log_json,
)

logger = logging.getLogger(__name__)


async def _attachment_cleanup_loop() -> None:
    from backend.app.core.database import SessionLocal
    from backend.app.services.repair_request_attachment_service import run_attachment_cleanup

    while True:
        await asyncio.sleep(24 * 60 * 60)
        try:
            with SessionLocal() as db:
                result = run_attachment_cleanup(db)
                logger.info(
                    "attachment_cleanup",
                    extra={
                        "orphan_dirs": result.orphan_dirs_removed,
                        "stale_files": result.stale_files_removed,
                        "empty_dirs": result.empty_dirs_removed,
                    },
                )
        except Exception:
            logger.exception("attachment_cleanup_failed")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    bind_main_event_loop(asyncio.get_running_loop())
    ensure_admin_user()
    ensure_tracker_webhook_actor()
    try:
        from backend.app.core.database import SessionLocal
        from backend.app.services.repair_request_attachment_service import run_attachment_cleanup

        with SessionLocal() as db:
            run_attachment_cleanup(db)
    except Exception:
        logger.exception("attachment_cleanup_startup_failed")
    cleanup_task = asyncio.create_task(_attachment_cleanup_loop())
    yield
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
    clear_main_event_loop()


_docs = settings.server.api_docs_enabled
app = FastAPI(
    title=settings.server.app_name,
    lifespan=lifespan,
    docs_url="/docs" if _docs else None,
    redoc_url="/redoc" if _docs else None,
    openapi_url="/openapi.json" if _docs else None,
)

app.add_middleware(RequestLoggingMiddleware)

_cors_raw = (settings.server.cors_origins or "").strip()
_cors_origins = [o.strip() for o in _cors_raw.split(",") if o.strip()]
if _cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    if exc.status_code >= 500:
        logger.error(
            "http_exception",
            extra={
                "method": request.method,
                "path": request.url.path,
                "status": exc.status_code,
                "detail": str(exc.detail)[:300],
            },
        )
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception(
        "unhandled_exception",
        extra={"method": request.method, "path": request.url.path},
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "internal_server_error"},
    )


app.include_router(api_router)
setup_metrics(app)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
