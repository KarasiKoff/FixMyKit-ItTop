"""Парсинг multipart-формы создания заявки (staff и публичная)."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, Request, UploadFile, status
from starlette.datastructures import UploadFile as StarletteUploadFile

from backend.app.services.repair_request_target import parse_repair_target


def collect_upload_files(form) -> list[UploadFile]:
    files: list[UploadFile] = []
    for key in ("files", "file"):
        for item in form.getlist(key):
            if isinstance(item, StarletteUploadFile) and item.filename:
                files.append(item)
    return files


async def parse_repair_request_form(
    request: Request,
    *,
    require_applicant: bool,
    allow_sync_to_tracker: bool = False,
) -> tuple[dict, list[UploadFile]]:
    form = await request.form()
    device_raw = form.get("device_id")
    audience_raw = form.get("audience_id")
    device_id = UUID(str(device_raw)) if device_raw is not None else None
    audience_id = UUID(str(audience_raw)) if audience_raw is not None else None
    device_id, audience_id = parse_repair_target(device_id=device_id, audience_id=audience_id)

    description = str(form.get("description") or "").strip()
    if not description:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="description_required")

    applicant_raw = form.get("applicant_name")
    if require_applicant:
        if applicant_raw is None or not str(applicant_raw).strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="applicant_name_required")
        applicant_name = str(applicant_raw).strip()
    else:
        applicant_name = str(applicant_raw).strip() if applicant_raw is not None else None

    sync_to_tracker = True
    if allow_sync_to_tracker:
        sync_raw = form.get("sync_to_tracker")
        if sync_raw is not None:
            sync_to_tracker = str(sync_raw).lower() in ("1", "true", "yes", "on")

    fields: dict = {
        "device_id": device_id,
        "audience_id": audience_id,
        "description": description,
        "applicant_name": applicant_name,
    }
    if allow_sync_to_tracker:
        fields["sync_to_tracker"] = sync_to_tracker

    return fields, collect_upload_files(form)
