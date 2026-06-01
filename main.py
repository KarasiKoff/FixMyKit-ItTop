import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from backend.app.core.config import settings

from backend.app.api.router import api_router
from backend.app.services.admin_bootstrap import ensure_admin_user
from backend.app.services.realtime_hub import bind_main_event_loop, clear_main_event_loop
from backend.app.services.tracker_webhook_bootstrap import ensure_tracker_webhook_actor
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
                    "attachment_cleanup orphan_dirs=%s stale_files=%s empty_dirs=%s",
                    result.orphan_dirs_removed,
                    result.stale_files_removed,
                    result.empty_dirs_removed,
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
    title=settings.app_name,
    lifespan=lifespan,
    docs_url="/docs" if _docs else None,
    redoc_url="/redoc" if _docs else None,
    openapi_url="/openapi.json" if _docs else None,
)

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

app.include_router(api_router)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
