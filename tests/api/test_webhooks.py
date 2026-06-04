"""POST /api/webhooks/yandex-tracker*."""

from __future__ import annotations

from backend.app.models.enums import RequestStatus
from backend.app.models.repair_request import RepairRequest
from backend.app.services.repair_request_webhook_service import TRACKER_WEBHOOK_SECRET_HEADER


def _seed_request(db, audience, *, status: RequestStatus, label: str, key: str) -> RepairRequest:
    row = RepairRequest(
        audience_id=audience.id,
        description="webhook test",
        status=status,
        tracker_ticket_key=key,
        tracker_ticket_id="999001",
        tracker_status_label=label,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def test_webhook_status_updates_request(client, db, webhook_headers, audience) -> None:
    repair_request = _seed_request(
        db,
        audience,
        status=RequestStatus.OPEN,
        label="Открыт",
        key="FIXMYKIT-WH-1",
    )

    response = client.post(
        "/api/webhooks/yandex-tracker",
        headers=webhook_headers,
        json={
            "issue_key": repair_request.tracker_ticket_key,
            "tracker_status": "Требуется информация",
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "updated"
    assert body["request_status"] == RequestStatus.NEEDS_INFO.value

    db.refresh(repair_request)
    assert repair_request.status == RequestStatus.NEEDS_INFO
    assert repair_request.tracker_status_label == "Требуется информация"


def test_webhook_invalid_secret(client, audience, db) -> None:
    repair_request = _seed_request(
        db,
        audience,
        status=RequestStatus.OPEN,
        label="Открыт",
        key="FIXMYKIT-WH-2",
    )
    response = client.post(
        "/api/webhooks/yandex-tracker",
        headers={TRACKER_WEBHOOK_SECRET_HEADER: "wrong"},
        json={
            "issue_key": repair_request.tracker_ticket_key,
            "tracker_status": "В работе",
        },
    )
    assert response.status_code == 401


def test_webhook_noop_when_status_missing(client, webhook_headers, audience, db) -> None:
    repair_request = _seed_request(
        db,
        audience,
        status=RequestStatus.IN_PROGRESS,
        label="В работе",
        key="FIXMYKIT-WH-3",
    )
    response = client.post(
        "/api/webhooks/yandex-tracker",
        headers=webhook_headers,
        json={"issue_key": repair_request.tracker_ticket_key, "tracker_status": ""},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "noop"


def test_webhook_unmapped_status(client, webhook_headers, audience, db) -> None:
    repair_request = _seed_request(
        db,
        audience,
        status=RequestStatus.OPEN,
        label="Открыт",
        key="FIXMYKIT-WH-4",
    )
    response = client.post(
        "/api/webhooks/yandex-tracker",
        headers=webhook_headers,
        json={
            "issue_key": repair_request.tracker_ticket_key,
            "tracker_status": "Неизвестный статус",
        },
    )
    assert response.status_code == 400
    detail = response.json()["detail"]
    assert detail["code"] == "unmapped_tracker_status"


def test_webhook_closed_status(client, db, webhook_headers, audience) -> None:
    repair_request = _seed_request(
        db,
        audience,
        status=RequestStatus.IN_PROGRESS,
        label="В работе",
        key="FIXMYKIT-WH-5",
    )
    response = client.post(
        "/api/webhooks/yandex-tracker",
        headers=webhook_headers,
        json={
            "issue_key": repair_request.tracker_ticket_key,
            "tracker_status": "Закрыт",
            "resolution": "Решен",
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "closed"
    assert body["request_status"] == RequestStatus.CLOSED.value
    db.refresh(repair_request)
    assert repair_request.status == RequestStatus.CLOSED


def test_webhook_publish(client, db, webhook_headers, audience) -> None:
    repair_request = _seed_request(
        db,
        audience,
        status=RequestStatus.OPEN,
        label="Открыт",
        key="FIXMYKIT-WH-6",
    )
    assert repair_request.is_published is False
    response = client.post(
        "/api/webhooks/yandex-tracker/publish",
        headers=webhook_headers,
        json={
            "issue_key": repair_request.tracker_ticket_key,
            "is_published": True,
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "published"
    db.refresh(repair_request)
    assert repair_request.is_published is True


def test_webhook_comment_created(client, db, webhook_headers, audience) -> None:
    repair_request = _seed_request(
        db,
        audience,
        status=RequestStatus.OPEN,
        label="Открыт",
        key="FIXMYKIT-WH-7",
    )
    response = client.post(
        "/api/webhooks/yandex-tracker/comment",
        headers=webhook_headers,
        json={
            "issue_key": repair_request.tracker_ticket_key,
            "comment_text": "Ответ из Трекера",
            "comment_id": "cmt-1001",
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "created"


def test_webhook_comment_skips_echo(client, webhook_headers, audience, db) -> None:
    repair_request = _seed_request(
        db,
        audience,
        status=RequestStatus.OPEN,
        label="Открыт",
        key="FIXMYKIT-WH-8",
    )
    response = client.post(
        "/api/webhooks/yandex-tracker/comment",
        headers=webhook_headers,
        json={
            "issue_key": repair_request.tracker_ticket_key,
            "comment_text": "(Fix My Kit): статус изменён",
        },
    )
    assert response.status_code == 200
    assert response.json()["status"] == "noop"
    assert response.json()["detail"] == "skipped_echo"


def test_webhook_sysadmin_taken(client, db, webhook_headers, audience) -> None:
    repair_request = _seed_request(
        db,
        audience,
        status=RequestStatus.OPEN,
        label="Открыт",
        key="FIXMYKIT-WH-9",
    )
    response = client.post(
        "/api/webhooks/yandex-tracker/sysadmin-taken",
        headers=webhook_headers,
        json={
            "issue_key": repair_request.tracker_ticket_key,
            "sysadmin_taken": True,
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["taken_by_sysadmin"] is True
    db.refresh(repair_request)
    assert repair_request.taken_by_sysadmin_at is not None
