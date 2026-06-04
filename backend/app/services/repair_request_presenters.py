"""Сериализация моделей заявок в ответы API."""

from __future__ import annotations

from backend.app.models.repair_request import RepairRequest
from backend.app.schemas.repair_request import RepairRequestResponse


def repair_request_to_list_response(item: RepairRequest) -> RepairRequestResponse:
    payload = RepairRequestResponse.model_validate(item)
    updates: dict = {}
    if item.device is not None:
        updates["device_inventory_number"] = item.device.inventory_number
        updates["device_name"] = item.device.name
    if item.audience is not None:
        updates["audience_name"] = item.audience.name
    if not updates:
        return payload
    return payload.model_copy(update=updates)
