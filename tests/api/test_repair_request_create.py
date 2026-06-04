"""POST /api/repair-requests и деталь заявки."""

from __future__ import annotations

from backend.app.models.enums import RequestStatus


def test_create_repair_request_by_audience_json(
    client,
    admin_headers,
    audience,
) -> None:
    response = client.post(
        "/api/repair-requests",
        headers=admin_headers,
        json={
            "audience_id": str(audience.id),
            "description": "Заявка из API-теста",
            "applicant_name": "tester",
            "sync_to_tracker": False,
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["audience_id"] == str(audience.id)
    assert body["audience_name"] == audience.name
    assert body["status"] == RequestStatus.OPEN.value

    detail = client.get(f"/api/repair-requests/{body['id']}", headers=admin_headers)
    assert detail.status_code == 200
    detail_body = detail.json()
    assert detail_body["audience_name"] == audience.name
    assert detail_body["description"] == "Заявка из API-теста"


def test_create_public_repair_request_json(client, audience, monkeypatch) -> None:
    monkeypatch.setattr(
        "backend.app.services.repair_request_create_service.try_tracker_sync",
        lambda request_id: None,
    )
    response = client.post(
        "/api/public/repair-requests",
        json={
            "audience_id": str(audience.id),
            "description": "Публичная заявка",
            "applicant_name": "guest",
        },
    )
    assert response.status_code == 201, response.text
    assert response.json()["status"] == RequestStatus.OPEN.value


def test_create_repair_request_by_device_json(
    client,
    admin_headers,
    device,
) -> None:
    response = client.post(
        "/api/repair-requests",
        headers=admin_headers,
        json={
            "device_id": str(device.id),
            "description": "Заявка по устройству",
            "sync_to_tracker": False,
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["device_id"] == str(device.id)
    assert body["device_name"] == device.name
    assert body["status"] == RequestStatus.OPEN.value
