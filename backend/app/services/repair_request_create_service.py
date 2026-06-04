"""Создание заявок на ремонт (staff API и публичная форма)."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from uuid import UUID

from fastapi import HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from backend.app.models.enums import RepairStatus
from backend.app.repositories.device_repository import DeviceRepository
from backend.app.models.repair_request import RepairRequest
from backend.app.models.user import User
from backend.app.repositories.repair_request_repository import RepairRequestRepository
from backend.app.schemas.repair_request import (
    PublicRepairRequestCreate,
    PublicRepairRequestResponse,
    RepairRequestCreate,
)
from backend.app.services.repair_history_service import add_repair_history
from backend.app.services.realtime_notify import notify_repair_request_updated
from backend.app.services.repair_request_attachment_service import (
    AttachmentLimitError,
    AttachmentValidationError,
    http_error_from_attachment_exc,
    recompute_attachment_fields,
    validate_and_store_uploads,
)
from backend.app.services.repair_request_form_parser import parse_repair_request_form
from backend.app.services.repair_request_target import ensure_no_active_request, ensure_target_exists
from backend.app.services.repair_request_tracker_sync import try_tracker_sync
from backend.app.services.tracker_service import issue_ref_for


@dataclass(frozen=True)
class RepairRequestCreateFields:
    device_id: UUID | None
    audience_id: UUID | None
    description: str
    applicant_name: str | None
    author_user_id: UUID | None = None
    sync_to_tracker: bool = True


def _record_request_created(db: Session, repair_request: RepairRequest) -> None:
    device = (
        DeviceRepository(db).get_by_id(repair_request.device_id)
        if repair_request.device_id is not None
        else None
    )
    if device is None:
        return
    old_rs = device.repair_status
    device.repair_status = RepairStatus.IN_REPAIR
    add_repair_history(
        db,
        device_id=device.id,
        repair_request_id=repair_request.id,
        old_status=old_rs,
        new_status=RepairStatus.IN_REPAIR,
        note="Создана заявка на ремонт",
    )


async def _store_uploads_safe(
    db: Session,
    repair_request: RepairRequest,
    uploads: list[UploadFile],
) -> None:
    if not uploads:
        return
    try:
        await validate_and_store_uploads(repair_request, uploads)
        db.commit()
    except (AttachmentLimitError, AttachmentValidationError) as exc:
        db.rollback()
        raise http_error_from_attachment_exc(exc) from exc


def _persist_new_request(db: Session, fields: RepairRequestCreateFields) -> RepairRequest:
    ensure_target_exists(db, fields.device_id, fields.audience_id)
    ensure_no_active_request(
        db,
        device_id=fields.device_id,
        audience_id=fields.audience_id,
    )
    repair_request = RepairRequestRepository(db).add_new(
        device_id=fields.device_id,
        audience_id=fields.audience_id,
        description=fields.description,
        applicant_name=fields.applicant_name,
        author_user_id=fields.author_user_id,
    )
    _record_request_created(db, repair_request)
    db.commit()
    db.refresh(repair_request)
    return repair_request


async def parse_staff_create_request(
    request: Request,
    current_user: User,
) -> tuple[RepairRequestCreateFields, list[UploadFile]]:
    content_type = (request.headers.get("content-type") or "").lower()
    if "multipart/form-data" in content_type:
        raw, uploads = await parse_repair_request_form(
            request,
            require_applicant=False,
            allow_sync_to_tracker=True,
        )
        return (
            RepairRequestCreateFields(
                device_id=raw["device_id"],
                audience_id=raw["audience_id"],
                description=raw["description"],
                applicant_name=raw["applicant_name"],
                author_user_id=current_user.id,
                sync_to_tracker=raw["sync_to_tracker"],
            ),
            uploads,
        )
    try:
        body = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_json") from exc
    payload = RepairRequestCreate.model_validate(body)
    return (
        RepairRequestCreateFields(
            device_id=payload.device_id,
            audience_id=payload.audience_id,
            description=payload.description,
            applicant_name=payload.applicant_name,
            author_user_id=payload.author_user_id or current_user.id,
            sync_to_tracker=payload.sync_to_tracker,
        ),
        [],
    )


async def parse_public_create_request(
    request: Request,
) -> tuple[RepairRequestCreateFields, list[UploadFile]]:
    content_type = (request.headers.get("content-type") or "").lower()
    if "multipart/form-data" in content_type:
        raw, uploads = await parse_repair_request_form(request, require_applicant=True)
        return (
            RepairRequestCreateFields(
                device_id=raw["device_id"],
                audience_id=raw["audience_id"],
                description=raw["description"],
                applicant_name=raw["applicant_name"],
                sync_to_tracker=True,
            ),
            uploads,
        )
    try:
        body = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_json") from exc
    payload = PublicRepairRequestCreate.model_validate(body)
    return (
        RepairRequestCreateFields(
            device_id=payload.device_id,
            audience_id=payload.audience_id,
            description=payload.description,
            applicant_name=payload.applicant_name,
            sync_to_tracker=True,
        ),
        [],
    )


async def create_staff_repair_request(
    db: Session,
    fields: RepairRequestCreateFields,
    uploads: list[UploadFile],
) -> RepairRequest:
    repair_request = _persist_new_request(db, fields)
    await _store_uploads_safe(db, repair_request, uploads)
    db.refresh(repair_request)
    notify_repair_request_updated(repair_request, source="api")

    if fields.sync_to_tracker:
        await asyncio.to_thread(try_tracker_sync, repair_request.id)
    elif uploads and issue_ref_for(repair_request) is None:
        recompute_attachment_fields(repair_request)
        db.commit()
    db.refresh(repair_request)
    return repair_request


async def create_public_repair_request(
    db: Session,
    fields: RepairRequestCreateFields,
    uploads: list[UploadFile],
) -> RepairRequest:
    repair_request = _persist_new_request(db, fields)
    await _store_uploads_safe(db, repair_request, uploads)
    db.refresh(repair_request)
    await asyncio.to_thread(try_tracker_sync, repair_request.id)
    db.refresh(repair_request)
    notify_repair_request_updated(repair_request, source="public_api")
    return repair_request


def public_create_response(repair_request: RepairRequest) -> PublicRepairRequestResponse:
    return PublicRepairRequestResponse(
        id=repair_request.id,
        status=repair_request.status,
        has_attachments=repair_request.has_attachments,
        attachments_sync_status=repair_request.attachments_sync_status,
        attachments_count=repair_request.attachments_count,
        attachments_synced_count=repair_request.attachments_synced_count,
    )
