"""Кабинеты (audiences): список, CRUD, конфликты имён."""

from __future__ import annotations

from uuid import uuid4

import pytest

pytestmark = pytest.mark.integration


def test_list_audiences_requires_auth(client) -> None:
    response = client.get("/api/audiences")
    assert response.status_code == 401


def test_list_audiences_sysadmin(client, sysadmin_headers, audience) -> None:
    response = client.get("/api/audiences", headers=sysadmin_headers)
    assert response.status_code == 200
    names = {item["name"] for item in response.json()["items"]}
    assert audience.name in names


def test_audience_crud_admin(client, admin_headers) -> None:
    name = f"Каб-{uuid4().hex[:8]}"
    create = client.post(
        "/api/audiences",
        headers=admin_headers,
        json={"name": name},
    )
    assert create.status_code == 201, create.text
    audience_id = create.json()["id"]

    duplicate = client.post(
        "/api/audiences",
        headers=admin_headers,
        json={"name": name},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "audience_exists"

    patch = client.patch(
        f"/api/audiences/{audience_id}",
        headers=admin_headers,
        json={"name": f"{name}-renamed"},
    )
    assert patch.status_code == 200
    assert patch.json()["name"] == f"{name}-renamed"

    delete = client.delete(f"/api/audiences/{audience_id}", headers=admin_headers)
    assert delete.status_code == 204


def test_create_audience_forbidden_for_sysadmin(client, sysadmin_headers) -> None:
    response = client.post(
        "/api/audiences",
        headers=sysadmin_headers,
        json={"name": f"Forbidden-{uuid4().hex[:8]}"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "forbidden"
