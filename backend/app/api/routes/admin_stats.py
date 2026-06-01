from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.api.deps import get_db, require_admin_or_sysadmin
from backend.app.models.user import User
from backend.app.schemas.admin_stats import AdminStatsResponse
from backend.app.services.admin_stats_service import build_admin_stats

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/stats", response_model=AdminStatsResponse)
def get_admin_stats(
    date_from: date | None = Query(None, description="Начало периода (включительно)"),
    date_to: date | None = Query(None, description="Конец периода (включительно)"),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_sysadmin),
) -> AdminStatsResponse:
    return build_admin_stats(db, date_from, date_to)
