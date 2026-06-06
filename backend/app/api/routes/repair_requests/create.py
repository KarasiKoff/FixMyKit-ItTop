from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from backend.app.api.deps import get_db, require_admin_or_sysadmin
from backend.app.models.user import User
from backend.app.schemas.repair_request import (
    PublicRepairRequestResponse,
    RepairRequestResponse,
)
from backend.app.services.repair_request_create_service import (
    create_public_repair_request as create_public_repair_request_svc,
    create_staff_repair_request,
    parse_public_create_request,
    parse_staff_create_request,
    public_create_response,
)
from backend.app.services.repair_request_presenters import (
    repair_request_to_list_response,
)

router = APIRouter()


@router.post(
    "/repair-requests",
    response_model=RepairRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_repair_request(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_sysadmin),
) -> RepairRequestResponse:
    fields, uploads = await parse_staff_create_request(request, current_user)
    repair_request = await create_staff_repair_request(db, fields, uploads)
    return repair_request_to_list_response(repair_request)


@router.post(
    "/public/repair-requests",
    response_model=PublicRepairRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_public_repair_request(
    request: Request,
    db: Session = Depends(get_db),
) -> PublicRepairRequestResponse:
    fields, uploads = await parse_public_create_request(request)
    repair_request = await create_public_repair_request_svc(db, fields, uploads)
    return public_create_response(repair_request)
