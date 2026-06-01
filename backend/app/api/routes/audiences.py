from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user, get_db
from backend.app.models.audience import Audience as AudienceModel
from backend.app.models.device import Device as DeviceModel
from backend.app.models.enums import UserRole
from backend.app.models.repair_history import RepairHistory
from backend.app.models.repair_request import RepairRequest
from backend.app.models.user import User
from backend.app.schemas.audience import Audience, AudienceCreate, AudienceList, AudienceUpdate

router = APIRouter(prefix="/api/audiences", tags=["audiences"])


def require_roles(allowed_roles: set[UserRole]):
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")
        return user

    return checker


@router.get("", response_model=AudienceList)
def list_audiences(
    name: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles({UserRole.ADMIN, UserRole.SYSADMIN})),
) -> AudienceList:
    query = db.query(AudienceModel)
    if name is not None:
        query = query.filter(AudienceModel.name.ilike(f"%{name}%"))
    items = query.order_by(AudienceModel.name).all()
    return AudienceList(items=items)


@router.post("", response_model=Audience, status_code=status.HTTP_201_CREATED)
def create_audience(
    payload: AudienceCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles({UserRole.ADMIN})),
) -> Audience:
    existing = db.query(AudienceModel).filter(AudienceModel.name == payload.name).first()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="audience_exists")

    audience = AudienceModel(name=payload.name)
    db.add(audience)
    db.commit()
    db.refresh(audience)
    return audience


def _delete_devices_for_audience(db: Session, audience_id: int) -> None:
    device_ids = [row[0] for row in db.query(DeviceModel.id).filter(DeviceModel.audience_id == audience_id).all()]
    for device_id in device_ids:
        db.query(RepairHistory).filter(RepairHistory.device_id == device_id).delete(synchronize_session=False)
        db.query(RepairRequest).filter(RepairRequest.device_id == device_id).delete(synchronize_session=False)
        db.query(DeviceModel).filter(DeviceModel.id == device_id).delete(synchronize_session=False)


@router.patch("/{audience_id}", response_model=Audience)
def update_audience(
    audience_id: int,
    payload: AudienceUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles({UserRole.ADMIN})),
) -> Audience:
    audience = db.query(AudienceModel).filter(AudienceModel.id == audience_id).first()
    if audience is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="audience_not_found")

    if payload.name is not None and payload.name != audience.name:
        clash = db.query(AudienceModel).filter(AudienceModel.name == payload.name).first()
        if clash is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="audience_exists")
        audience.name = payload.name

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="audience_exists") from exc
    db.refresh(audience)
    return audience


@router.delete("/{audience_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_audience(
    audience_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles({UserRole.ADMIN})),
) -> None:
    audience = db.query(AudienceModel).filter(AudienceModel.id == audience_id).first()
    if audience is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="audience_not_found")

    _delete_devices_for_audience(db, audience_id)
    db.delete(audience)
    db.commit()
