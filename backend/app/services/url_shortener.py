"""Сокращение ссылок через clck.ru (Яндекс Кликер)."""

from __future__ import annotations

import logging
from urllib import error, request
from urllib.parse import urlencode, urlparse

from fastapi import HTTPException, status

from backend.app.core.config import settings

logger = logging.getLogger(__name__)

CLCK_API = "https://clck.ru/--"
CLCK_TIMEOUT_SECONDS = 10

_LOCAL_HOSTS = frozenset({"localhost", "127.0.0.1"})


def _is_app_frontend_path(path: str) -> bool:
    return path == "/scan" or path.startswith("/device/") or path.startswith("/audience/")


def shorten_via_clck(url: str) -> str:
    """Возвращает короткую ссылку clck.ru или исходную при ошибке."""
    if not settings.clck_shortener_enabled:
        return url
    try:
        api_url = f"{CLCK_API}?{urlencode({'url': url})}"
        req = request.Request(
            api_url,
            method="POST",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        with request.urlopen(req, timeout=CLCK_TIMEOUT_SECONDS) as resp:
            short = resp.read().decode("utf-8", errors="replace").strip()
        if short.startswith("http"):
            return short
        return url
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:200]
        logger.warning("clck shorten failed status=%s body=%s", exc.code, body)
        return url
    except error.URLError:
        logger.exception("clck shorten request failed")
        return url
    except Exception:
        logger.exception("clck shorten unexpected error")
        return url


def assert_allowed_shorten_url(url: str) -> str:
    """Разрешаем сокращать только ссылки на наш фронт; возвращает абсолютный URL."""
    base = settings.public_frontend_base_url.rstrip("/")
    normalized = url.strip()
    if normalized.startswith("/"):
        return f"{base}{normalized}"

    parsed = urlparse(normalized)
    if not parsed.scheme or not parsed.netloc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="url_not_allowed")

    path = parsed.path or ""

    # Общая страница /scan — с фронта может прийти боевой домен, на бэке другой PUBLIC_FRONTEND_BASE_URL
    if path == "/scan":
        return normalized

    if not _is_app_frontend_path(path):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="url_not_allowed")

    if normalized.startswith(base):
        return normalized

    if parsed.hostname in _LOCAL_HOSTS:
        return normalized

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="url_not_allowed")
