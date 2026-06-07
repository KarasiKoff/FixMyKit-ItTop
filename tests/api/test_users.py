"""Управление пользователями (только admin создаёт и меняет)."""

from __future__ import annotations

from uuid import uuid4

import pytest

pytestmark = pytest.mark.integration


def test_list_users_requires_auth(client) -> None:
    response = client.get("/api/users")
    assert response.status_code == 401


def test_list_users_admin_and_sysadmin(client, admin_headers, sysadmin_headers) -> None:
    for headers in (admin_headers, sysadmin_headers):
        response = client.get("/api/users", headers=headers)
        assert response.status_code == 200
        assert response.json()["total"] >= 1


def test_create_user_admin_only(client, admin_headers, sysadmin_headers) -> None:
    login = f"user_{uuid4().hex[:8]}"
    create = client.post(
        "/api/users",
        headers=admin_headers,
        json={
            "login": login,
            "password": "password123",
            "role": "sysadmin",
            "full_name": "Тестовый сисадмин",
        },
    )
    assert create.status_code == 201, create.text
    user_id = create.json()["id"]
    assert create.json()["login"] == login

    duplicate = client.post(
        "/api/users",
        headers=admin_headers,
        json={
            "login": login,
            "password": "password123",
            "role": "sysadmin",
        },
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "login_exists"

    forbidden = client.post(
        "/api/users",
        headers=sysadmin_headers,
        json={
            "login": f"other_{uuid4().hex[:8]}",
            "password": "password123",
            "role": "sysadmin",
        },
    )
    assert forbidden.status_code == 403

    patch = client.patch(
        f"/api/users/{user_id}",
        headers=admin_headers,
        json={"full_name": "Обновлённое имя"},
    )
    assert patch.status_code == 200
    assert patch.json()["full_name"] == "Обновлённое имя"

    reset_pw = client.patch(
        f"/api/users/{user_id}/password",
        headers=admin_headers,
        json={"password": "newpassword99"},
    )
    assert reset_pw.status_code == 204


def test_admin_cannot_deactivate_self(client, admin_headers, admin_user) -> None:
    response = client.patch(
        f"/api/users/{admin_user.id}",
        headers=admin_headers,
        json={"is_active": False},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "cannot_deactivate_self"
