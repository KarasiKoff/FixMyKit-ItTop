from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_admin, get_db, get_optional_user
from backend.app.models.user import User
from backend.app.schemas.site_announcement import (
    ActiveAnnouncementsResponse,
    AdminAnnouncementsResponse,
    AdminAnnouncementsUpdateRequest,
    ResetDismissalsResponse,
)
from backend.app.services.site_announcement_service import (
    list_active_for_viewer,
    list_admin_slots,
    reset_dismissals,
    update_admin_slots,
)

router = APIRouter(tags=["announcements"])

_ACTIVE_CACHE_SECONDS = 60


@router.get("/api/announcements/active")
def get_active_announcements(
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
) -> JSONResponse:
    items = list_active_for_viewer(db, current_user)
    body = ActiveAnnouncementsResponse(items=items)
    return JSONResponse(
        content=body.model_dump(mode="json"),
        headers={"Cache-Control": f"public, max-age={_ACTIVE_CACHE_SECONDS}"},
    )


@router.get("/api/admin/announcements", response_model=AdminAnnouncementsResponse)
def get_admin_announcements(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> AdminAnnouncementsResponse:
    return list_admin_slots(db)


@router.put("/api/admin/announcements", response_model=AdminAnnouncementsResponse)
def put_admin_announcements(
    body: AdminAnnouncementsUpdateRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_admin),
) -> AdminAnnouncementsResponse:
    return update_admin_slots(db, body.slots, actor)


@router.post(
    "/api/admin/announcements/reset-dismissals", response_model=ResetDismissalsResponse
)
def post_reset_announcement_dismissals(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> ResetDismissalsResponse:
    return reset_dismissals(db)
