"""POST .../tracker/push-status и .../tracker/sync."""

from __future__ import annotations

import time

import pytest
from sqlalchemy.orm import Session

from backend.app.models.repair_request import RepairRequest

pytestmark = pytest.mark.integration


def _create_request_id(client, admin_headers, audience_id: str) -> str:
    response = client.post(
        "/api/repair-requests",
        headers=admin_headers,
        json={
            "audience_id": audience_id,
            "description": "tracker push test",
            "sync_to_tracker": False,
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_push_status_requires_pending_flag(client, admin_headers, audience) -> None:
    request_id = _create_request_id(client, admin_headers, str(audience.id))
    response = client.post(
        f"/api/repair-requests/{request_id}/tracker/push-status",
        headers=admin_headers,
    )
    assert response.status_code == 409
    assert response.json()["detail"] == "tracker_status_sync_not_pending"


def test_push_status_clears_pending(client, admin_headers, audience, db) -> None:
    request_id = _create_request_id(client, admin_headers, str(audience.id))
    repair_request = db.get(RepairRequest, request_id)
    repair_request.tracker_status_sync_pending = True
    repair_request.tracker_status_label = "В работе"
    db.commit()

    response = client.post(
        f"/api/repair-requests/{request_id}/tracker/push-status",
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text
    assert response.json()["tracker_status_sync_pending"] is False


def test_push_status_tracker_unavailable(
    client,
    admin_headers,
    audience,
    db,
    monkeypatch,
) -> None:
    from fastapi import HTTPException

    request_id = _create_request_id(client, admin_headers, str(audience.id))
    repair_request = db.get(RepairRequest, request_id)
    repair_request.tracker_status_sync_pending = True
    repair_request.tracker_ticket_key = "FIX-PUSH-1"
    repair_request.tracker_status_label = "В работе"
    db.commit()

    def _failing_sync(
        db_sess: Session, rr: RepairRequest, label: str, **kwargs
    ) -> None:
        rr.tracker_status_sync_pending = True
        db_sess.commit()
        raise HTTPException(status_code=502, detail="tracker_unavailable")

    monkeypatch.setattr(
        "backend.app.services.repair_request_actions_service.retry_pending_status_sync",
        lambda db_sess, rr: _failing_sync(
            db_sess,
            rr,
            (rr.tracker_status_label or "").strip() or "В работе",
        ),
    )

    response = client.post(
        f"/api/repair-requests/{request_id}/tracker/push-status",
        headers=admin_headers,
    )
    assert response.status_code == 502
    assert response.json()["detail"] == "tracker_unavailable"
    db.refresh(repair_request)
    assert repair_request.tracker_status_sync_pending is True


@pytest.mark.tracker_http
def test_tracker_sync_success(
    client,
    admin_headers,
    audience,
    db,
    fake_tracker_client,
) -> None:
    request_id = _create_request_id(client, admin_headers, str(audience.id))
    response = client.post(
        f"/api/repair-requests/{request_id}/tracker/sync",
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["tracker_ticket_key"] == "FIX-99"
    assert body["tracker_ticket_id"] == "12345"
    assert "last_sync_at" in body
    assert any(call[0] == "POST" for call in fake_tracker_client.calls)

    repair_request = db.get(RepairRequest, request_id)
    assert repair_request.tracker_ticket_key == "FIX-99"


@pytest.mark.tracker_http
def test_tracker_sync_unavailable(
    client, admin_headers, audience, failing_tracker_client
) -> None:
    request_id = _create_request_id(client, admin_headers, str(audience.id))
    response = client.post(
        f"/api/repair-requests/{request_id}/tracker/sync",
        headers=admin_headers,
    )
    assert response.status_code == 502
    assert response.json()["detail"] == "tracker_unavailable"
    assert any(call[0] == "POST" for call in failing_tracker_client.calls)


@pytest.mark.tracker_http
def test_create_staff_syncs_tracker_in_background(
    client,
    admin_headers,
    audience,
    db,
    fake_tracker_client,
) -> None:
    response = client.post(
        "/api/repair-requests",
        headers=admin_headers,
        json={
            "audience_id": str(audience.id),
            "description": "sync on create",
            "sync_to_tracker": True,
        },
    )
    assert response.status_code == 201, response.text
    request_id = response.json()["id"]

    deadline = time.monotonic() + 5.0
    ticket_key = None
    while time.monotonic() < deadline:
        db.expire_all()
        rr = db.get(RepairRequest, request_id)
        ticket_key = (rr.tracker_ticket_key or "").strip() if rr else ""
        if ticket_key:
            break
        time.sleep(0.05)

    assert ticket_key == "FIX-99"
    assert any(call[0] == "POST" for call in fake_tracker_client.calls)
