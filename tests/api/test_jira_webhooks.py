"""POST /api/webhooks/jira*."""

from __future__ import annotations

from backend.app.models.enums import RequestStatus
from backend.app.models.repair_request import RepairRequest
from backend.app.services.repair_request_jira_webhook_service import (
    JIRA_WEBHOOK_SECRET_HEADER,
)


def _seed_request(
    db, audience, *, status: RequestStatus, label: str, key: str
) -> RepairRequest:
    row = RepairRequest(
        audience_id=audience.id,
        description="jira webhook test",
        status=status,
        tracker_ticket_key=key,
        tracker_ticket_id="10042",
        tracker_status_label=label,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def test_jira_webhook_status_updates_request(
    client, db, jira_webhook_headers, audience, monkeypatch
) -> None:
    monkeypatch.setattr(
        "backend.app.services.repair_request_jira_webhook_service.get_issue_tracker",
        lambda: type("T", (), {"add_comment": lambda *a, **k: None})(),
    )
    repair_request = _seed_request(
        db,
        audience,
        status=RequestStatus.OPEN,
        label="To Do",
        key="FMK-WH-1",
    )
    response = client.post(
        "/api/webhooks/jira",
        headers=jira_webhook_headers,
        json={
            "issue_key": repair_request.tracker_ticket_key,
            "jira_status": "In Progress",
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "updated"
    assert body["request_status"] == RequestStatus.IN_PROGRESS.value
    db.refresh(repair_request)
    assert repair_request.status == RequestStatus.IN_PROGRESS
    assert repair_request.tracker_status_label == "In Progress"


def test_jira_webhook_invalid_secret(client, audience, db) -> None:
    repair_request = _seed_request(
        db,
        audience,
        status=RequestStatus.OPEN,
        label="To Do",
        key="FMK-WH-2",
    )
    response = client.post(
        "/api/webhooks/jira",
        headers={JIRA_WEBHOOK_SECRET_HEADER: "wrong"},
        json={
            "issue_key": repair_request.tracker_ticket_key,
            "jira_status": "In Progress",
        },
    )
    assert response.status_code == 401


def test_jira_webhook_unmapped_status(client, jira_webhook_headers, audience, db) -> None:
    repair_request = _seed_request(
        db,
        audience,
        status=RequestStatus.OPEN,
        label="To Do",
        key="FMK-WH-3",
    )
    response = client.post(
        "/api/webhooks/jira",
        headers=jira_webhook_headers,
        json={
            "issue_key": repair_request.tracker_ticket_key,
            "jira_status": "Backlog",
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "unmapped_jira_status"


def test_jira_webhook_closed(client, db, jira_webhook_headers, audience, monkeypatch) -> None:
    monkeypatch.setattr(
        "backend.app.services.repair_request_jira_webhook_service.get_issue_tracker",
        lambda: type("T", (), {"add_comment": lambda *a, **k: None})(),
    )
    repair_request = _seed_request(
        db,
        audience,
        status=RequestStatus.IN_PROGRESS,
        label="In Progress",
        key="FMK-WH-4",
    )
    response = client.post(
        "/api/webhooks/jira",
        headers=jira_webhook_headers,
        json={
            "issue_key": repair_request.tracker_ticket_key,
            "jira_status": "Done",
            "resolution": "Fixed",
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "closed"
    db.refresh(repair_request)
    assert repair_request.status == RequestStatus.CLOSED


def test_jira_webhook_comment_created(client, db, jira_webhook_headers, audience) -> None:
    repair_request = _seed_request(
        db,
        audience,
        status=RequestStatus.OPEN,
        label="To Do",
        key="FMK-WH-5",
    )
    response = client.post(
        "/api/webhooks/jira/comment",
        headers=jira_webhook_headers,
        json={
            "issue_key": repair_request.tracker_ticket_key,
            "comment_text": "Ответ из Jira",
            "comment_id": "jira-cmt-1",
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "created"


def test_jira_webhook_comment_skips_echo(client, jira_webhook_headers, audience, db) -> None:
    repair_request = _seed_request(
        db,
        audience,
        status=RequestStatus.OPEN,
        label="To Do",
        key="FMK-WH-6",
    )
    response = client.post(
        "/api/webhooks/jira/comment",
        headers=jira_webhook_headers,
        json={
            "issue_key": repair_request.tracker_ticket_key,
            "comment_text": "[Fix My Kit] Синхронизирован статус",
        },
    )
    assert response.status_code == 200
    assert response.json()["status"] == "noop"
    assert response.json()["detail"] == "skipped_echo"
