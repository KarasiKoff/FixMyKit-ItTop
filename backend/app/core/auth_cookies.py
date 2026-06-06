"""httpOnly cookie для JWT."""

from __future__ import annotations

from fastapi import Response

from backend.app.core.config import settings


def _cookie_kwargs() -> dict:
    server = settings.server
    kwargs: dict = {
        "key": server.auth_cookie_name,
        "httponly": True,
        "max_age": server.access_token_expire_minutes * 60,
        "path": "/",
        "secure": server.auth_cookie_secure,
        "samesite": server.auth_cookie_samesite,
    }
    domain = (server.auth_cookie_domain or "").strip()
    if domain:
        kwargs["domain"] = domain
    return kwargs


def set_auth_cookie(response: Response, access_token: str) -> None:
    response.set_cookie(value=access_token, **_cookie_kwargs())


def clear_auth_cookie(response: Response) -> None:
    server = settings.server
    kwargs: dict = {
        "key": server.auth_cookie_name,
        "httponly": True,
        "max_age": 0,
        "path": "/",
        "secure": server.auth_cookie_secure,
        "samesite": server.auth_cookie_samesite,
    }
    domain = (server.auth_cookie_domain or "").strip()
    if domain:
        kwargs["domain"] = domain
    response.delete_cookie(**kwargs)
