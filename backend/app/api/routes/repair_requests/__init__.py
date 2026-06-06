from fastapi import APIRouter

from backend.app.api.routes.repair_requests.attachments import (
    router as attachments_router,
)
from backend.app.api.routes.repair_requests.comments import router as comments_router
from backend.app.api.routes.repair_requests.create import router as create_router
from backend.app.api.routes.repair_requests.detail import router as detail_router
from backend.app.api.routes.repair_requests.list import router as list_router
from backend.app.api.routes.repair_requests.tracker import router as tracker_router

router = APIRouter(prefix="/api", tags=["repair-requests"])
router.include_router(list_router)
router.include_router(create_router)
router.include_router(detail_router)
router.include_router(comments_router)
router.include_router(tracker_router)
router.include_router(attachments_router)
