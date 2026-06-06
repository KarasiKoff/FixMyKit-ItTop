"""httpOnly cookie для JWT и logout."""

from __future__ import annotations

from backend.app.core.config import settings


def test_login_sets_http_only_cookie(client) -> None:
    response = client.post(
        "/api/auth/login",
        json={"login": "admin", "password": "admin"},
    )
    assert response.status_code == 200
    assert response.json() == {"token_type": "bearer"}
    assert "access_token" not in response.json()

    cookie_name = settings.server.auth_cookie_name
    assert cookie_name in response.cookies
    set_cookie = (response.headers.get("set-cookie") or "").lower()
    assert "httponly" in set_cookie


def test_me_with_cookie_without_bearer(client) -> None:
    login = client.post("/api/auth/login", json={"login": "admin", "password": "admin"})
    assert login.status_code == 200

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["login"] == "admin"


def test_logout_clears_session(client) -> None:
    client.post("/api/auth/login", json={"login": "admin", "password": "admin"})
    logout = client.post("/api/auth/logout")
    assert logout.status_code == 204

    me = client.get("/api/auth/me")
    assert me.status_code == 401
