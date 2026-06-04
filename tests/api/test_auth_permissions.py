"""Авторизация и роли на защищённых эндпоинтах."""

from __future__ import annotations


def test_list_repair_requests_requires_auth(client) -> None:
    response = client.get("/api/repair-requests")
    assert response.status_code == 401


def test_create_audience_forbidden_for_sysadmin(client, sysadmin_headers) -> None:
    response = client.post(
        "/api/audiences",
        headers=sysadmin_headers,
        json={"name": "Кабинет только для админа"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "forbidden"
