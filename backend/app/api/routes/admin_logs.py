from pathlib import Path

from fastapi import APIRouter, Depends, Query

from backend.app.api.deps import get_current_admin
from backend.app.core.config import settings
from backend.app.models.user import User
from backend.app.schemas.admin_logs import AdminLogsResponse, LogEntry, LogLevelFilter, LogSource
from backend.app.services.admin_logs_service import log_sources_status, tail_log_entries

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/logs", response_model=AdminLogsResponse)
def get_admin_logs(
    source: LogSource = Query("app", description="app — все штатные события; error — только ERROR/CRITICAL"),
    level: LogLevelFilter = Query("ALL"),
    search: str | None = Query(None, max_length=200),
    limit: int = Query(200, ge=1, le=1000),
    _: User = Depends(get_current_admin),
) -> AdminLogsResponse:
    log_dir = Path(settings.server.log_dir)
    raw_items = tail_log_entries(
        log_dir,
        source=source,
        limit=limit,
        level=level,
        search=search,
    )
    items = [LogEntry.model_validate(row) for row in raw_items]
    return AdminLogsResponse(
        source=source,
        level_filter=level,
        items=items,
        files=log_sources_status(log_dir),
    )
