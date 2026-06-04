from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user, get_db
from backend.app.models.audience import Audience as AudienceModel
from backend.app.models.enums import UserRole
from backend.app.models.user import User
from backend.app.repositories.audience_repository import AudienceRepository
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
    items = AudienceRepository(db).list_all(name_contains=name)
    return AudienceList(items=items)


@router.post("", response_model=Audience, status_code=status.HTTP_201_CREATED)
def create_audience(
    payload: AudienceCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles({UserRole.ADMIN})),
) -> Audience:
    if AudienceRepository(db).get_by_name(payload.name) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="audience_exists")

    audience = AudienceModel(name=payload.name)
    db.add(audience)
    db.commit()
    db.refresh(audience)
    return audience


@router.patch("/{audience_id}", response_model=Audience)
def update_audience(
    audience_id: UUID,
    payload: AudienceUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles({UserRole.ADMIN})),
) -> Audience:
    repo = AudienceRepository(db)
    audience = repo.get_or_404(audience_id)

    if payload.name is not None and payload.name != audience.name:
        if repo.get_by_name(payload.name) is not None:
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
    audience_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles({UserRole.ADMIN})),
) -> None:
    repo = AudienceRepository(db)
    audience = repo.get_or_404(audience_id)
    repo.delete_devices_for_audience(audience_id)
    db.delete(audience)
    db.commit()
