"""CRUD устройств и связанные эндпоинты."""

from __future__ import annotations

from uuid import uuid4

import pytest

pytestmark = pytest.mark.integration


def test_list_devices_requires_auth(client) -> None:
    response = client.get("/api/devices")
    assert response.status_code == 401


def test_list_devices_includes_seed(client, admin_headers, device) -> None:
    response = client.get("/api/devices", headers=admin_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["total"] >= 1
    ids = {item["id"] for item in body["items"]}
    assert str(device.id) in ids


def test_create_get_patch_delete_device(client, admin_headers, audience) -> None:
    inv = f"INV-{uuid4().hex[:8]}"
    create = client.post(
        "/api/devices",
        headers=admin_headers,
        json={
            "inventory_number": inv,
            "name": "Ноутбук тест",
            "audience_id": str(audience.id),
        },
    )
    assert create.status_code == 201, create.text
    device_id = create.json()["id"]
    assert create.json()["inventory_number"] == inv

    get_one = client.get(f"/api/devices/{device_id}", headers=admin_headers)
    assert get_one.status_code == 200
    assert get_one.json()["name"] == "Ноутбук тест"

    patch = client.patch(
        f"/api/devices/{device_id}",
        headers=admin_headers,
        json={"name": "Ноутбук обновлён"},
    )
    assert patch.status_code == 200
    assert patch.json()["name"] == "Ноутбук обновлён"

    qr = client.get(f"/api/devices/{device_id}/qr", headers=admin_headers)
    assert qr.status_code == 200
    assert qr.json()["device_id"] == device_id
    assert "/device/" in qr.json()["url"]

    history = client.get(f"/api/devices/{device_id}/history", headers=admin_headers)
    assert history.status_code == 200
    assert "items" in history.json()

    delete = client.delete(f"/api/devices/{device_id}", headers=admin_headers)
    assert delete.status_code == 204

    missing = client.get(f"/api/devices/{device_id}", headers=admin_headers)
    assert missing.status_code == 404


def test_create_device_duplicate_inventory(
    client, admin_headers, device, audience
) -> None:
    response = client.post(
        "/api/devices",
        headers=admin_headers,
        json={
            "inventory_number": device.inventory_number,
            "name": "Дубликат",
            "audience_id": str(audience.id),
        },
    )
    assert response.status_code == 409
    assert response.json()["detail"] == "inventory_number_exists"


def test_device_suggest_invalid_field(client, admin_headers) -> None:
    response = client.get(
        "/api/devices/suggest",
        headers=admin_headers,
        params={"field": "unknown", "q": "x"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "invalid_suggest_field"


def test_sysadmin_can_manage_devices(client, sysadmin_headers, audience) -> None:
    inv = f"INV-{uuid4().hex[:8]}"
    response = client.post(
        "/api/devices",
        headers=sysadmin_headers,
        json={
            "inventory_number": inv,
            "name": "Sysadmin device",
            "audience_id": str(audience.id),
        },
    )
    assert response.status_code == 201
