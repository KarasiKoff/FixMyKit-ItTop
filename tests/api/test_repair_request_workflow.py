"""PATCH /api/repair-requests/{id}/workflow."""

from __future__ import annotations

from backend.app.models.enums import RequestStatus


def _create_request(client, admin_headers, audience_id: str) -> str:
    response = client.post(
        "/api/repair-requests",
        headers=admin_headers,
        json={
            "audience_id": audience_id,
            "description": "workflow test",
            "sync_to_tracker": False,
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_workflow_needs_info_requires_comment(client, admin_headers, audience) -> None:
    request_id = _create_request(client, admin_headers, str(audience.id))
    response = client.patch(
        f"/api/repair-requests/{request_id}/workflow",
        headers=admin_headers,
        json={"workflow": "needs_info", "comment": ""},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "comment_required_for_needs_info"


def test_workflow_needs_info_then_in_progress(client, admin_headers, audience) -> None:
    request_id = _create_request(client, admin_headers, str(audience.id))

    needs_info = client.patch(
        f"/api/repair-requests/{request_id}/workflow",
        headers=admin_headers,
        json={"workflow": "needs_info", "comment": "Нужны данные"},
    )
    assert needs_info.status_code == 200, needs_info.text
    assert needs_info.json()["status"] == RequestStatus.NEEDS_INFO.value
    assert needs_info.json()["tracker_status_label"] == "Требуется информация"

    in_progress = client.patch(
        f"/api/repair-requests/{request_id}/workflow",
        headers=admin_headers,
        json={"workflow": "in_progress"},
    )
    assert in_progress.status_code == 200, in_progress.text
    body = in_progress.json()
    assert body["status"] == RequestStatus.IN_PROGRESS.value
    assert body["tracker_status_label"] == "В работе"
    assert body["tracker_status_sync_pending"] is False


def test_workflow_in_progress_then_open(client, admin_headers, audience) -> None:
    request_id = _create_request(client, admin_headers, str(audience.id))

    in_progress = client.patch(
        f"/api/repair-requests/{request_id}/workflow",
        headers=admin_headers,
        json={"workflow": "in_progress"},
    )
    assert in_progress.status_code == 200, in_progress.text
    assert in_progress.json()["status"] == RequestStatus.IN_PROGRESS.value

    reopen = client.patch(
        f"/api/repair-requests/{request_id}/workflow",
        headers=admin_headers,
        json={"workflow": "open"},
    )
    assert reopen.status_code == 200, reopen.text
    body = reopen.json()
    assert body["status"] == RequestStatus.OPEN.value
    assert body["tracker_status_label"] == "Открыт"


def test_workflow_closed_requires_resolution(client, admin_headers, audience) -> None:
    request_id = _create_request(client, admin_headers, str(audience.id))
    response = client.patch(
        f"/api/repair-requests/{request_id}/workflow",
        headers=admin_headers,
        json={"workflow": "closed", "comment": "готово"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "resolution_required_for_close"


def test_status_patch_closed_to_open_rejected(client, admin_headers, audience) -> None:
    request_id = _create_request(client, admin_headers, str(audience.id))
    closed = client.patch(
        f"/api/repair-requests/{request_id}/workflow",
        headers=admin_headers,
        json={
            "workflow": "closed",
            "resolution": "resolved",
            "comment": "Починили",
        },
    )
    assert closed.status_code == 200, closed.text

    reopen = client.patch(
        f"/api/repair-requests/{request_id}/status",
        headers=admin_headers,
        json={"status": RequestStatus.OPEN.value},
    )
    assert reopen.status_code == 409
    assert reopen.json()["detail"] == "invalid_status_transition"


def test_workflow_closed_resolved(client, admin_headers, audience) -> None:
    request_id = _create_request(client, admin_headers, str(audience.id))
    response = client.patch(
        f"/api/repair-requests/{request_id}/workflow",
        headers=admin_headers,
        json={
            "workflow": "closed",
            "resolution": "resolved",
            "comment": "Починили",
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == RequestStatus.CLOSED.value
    assert body["tracker_status_label"] == "Закрыт"
    assert body["resolution_note"] == "Решен"
