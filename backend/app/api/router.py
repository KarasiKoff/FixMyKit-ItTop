from fastapi import APIRouter

from backend.app.api.routes.announcements import router as announcements_router
from backend.app.api.routes.admin_logs import router as admin_logs_router
from backend.app.api.routes.admin_maintenance import router as admin_maintenance_router
from backend.app.api.routes.admin_stats import router as admin_stats_router
from backend.app.api.routes.auth import router as auth_router
from backend.app.api.routes.debug import router as debug_router
from backend.app.api.routes.devices import router as devices_router
from backend.app.api.routes.categories import router as categories_router
from backend.app.api.routes.audiences import router as audiences_router
from backend.app.api.routes.health import router as health_router
from backend.app.api.routes.repair_requests import router as repair_requests_router
from backend.app.api.routes.public import router as public_router
from backend.app.api.routes.users import router as users_router

from backend.app.api.routes.room_map import router as room_map_router
from backend.app.api.routes.webhooks import router as webhooks_router
from backend.app.api.routes.events import router as events_router

api_router = APIRouter()
api_router.include_router(debug_router)
api_router.include_router(announcements_router)
api_router.include_router(admin_stats_router)
api_router.include_router(admin_logs_router)
api_router.include_router(admin_maintenance_router)
api_router.include_router(auth_router)
api_router.include_router(devices_router)
api_router.include_router(categories_router)
api_router.include_router(audiences_router)
api_router.include_router(health_router, tags=["health"])
api_router.include_router(webhooks_router)
api_router.include_router(events_router)
api_router.include_router(repair_requests_router)
api_router.include_router(users_router)
api_router.include_router(public_router)
api_router.include_router(room_map_router)
