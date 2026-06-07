"""Авторизация и роли на защищённых эндпоинтах."""

from __future__ import annotations


def test_list_repair_requests_requires_auth(client) -> None:
    response = client.get("/api/repair-requests")
    assert response.status_code == 401
