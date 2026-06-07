"""Справочник категорий: CRUD и права доступа."""

from __future__ import annotations

from uuid import uuid4

import pytest

pytestmark = pytest.mark.integration


def test_list_categories_requires_auth(client) -> None:
    response = client.get("/api/categories")
    assert response.status_code == 401


def test_category_crud_admin_only(client, admin_headers, sysadmin_headers) -> None:
    name = f"Категория-{uuid4().hex[:6]}"
    create = client.post(
        "/api/categories",
        headers=admin_headers,
        json={"name": name},
    )
    assert create.status_code == 201, create.text
    category_id = create.json()["id"]
    assert create.json()["name"] == name

    listing = client.get("/api/categories", headers=sysadmin_headers)
    assert listing.status_code == 200
    names = {item["name"] for item in listing.json()["items"]}
    assert name in names

    forbidden = client.post(
        "/api/categories",
        headers=sysadmin_headers,
        json={"name": f"Forbidden-{uuid4().hex[:6]}"},
    )
    assert forbidden.status_code == 403

    patch = client.patch(
        f"/api/categories/{category_id}",
        headers=admin_headers,
        json={"name": f"{name}-updated", "is_active": False},
    )
    assert patch.status_code == 200
    assert patch.json()["name"] == f"{name}-updated"
    assert patch.json()["is_active"] is False

    sub = client.post(
        f"/api/categories/{category_id}/subcategories",
        headers=admin_headers,
        json={"name": "Подтип А"},
    )
    assert sub.status_code == 201, sub.text
    sub_id = sub.json()["id"]

    sub_patch = client.patch(
        f"/api/categories/subcategories/{sub_id}",
        headers=admin_headers,
        json={"name": "Подтип Б"},
    )
    assert sub_patch.status_code == 200
    assert sub_patch.json()["name"] == "Подтип Б"

    sub_delete = client.delete(
        f"/api/categories/subcategories/{sub_id}",
        headers=admin_headers,
    )
    assert sub_delete.status_code == 204

    delete = client.delete(f"/api/categories/{category_id}", headers=admin_headers)
    assert delete.status_code == 204
