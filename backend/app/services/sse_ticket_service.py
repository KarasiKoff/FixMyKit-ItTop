"""Короткоживущие opaque-токены для SSE (вместо JWT в query string)."""

from __future__ import annotations

import json
import logging
import secrets
import time
from threading import Lock
from uuid import UUID

from backend.app.core.config import settings

logger = logging.getLogger(__name__)

_TICKET_KEY_PREFIX = "fixmykit:sse:ticket:"

_memory_tickets: dict[str, tuple[str, float]] = {}
_memory_lock = Lock()

_sync_redis = None
_sync_redis_lock = Lock()


def _ticket_key(token: str) -> str:
    return f"{_TICKET_KEY_PREFIX}{token}"


def _ttl_seconds() -> int:
    return max(30, int(settings.server.sse_ticket_ttl_seconds))


def _use_redis() -> bool:
    return bool((settings.server.redis_url or "").strip())


def _get_sync_redis():
    global _sync_redis
    if not _use_redis():
        return None
    with _sync_redis_lock:
        if _sync_redis is None:
            import redis

            _sync_redis = redis.Redis.from_url(
                settings.server.redis_url.strip(),
                decode_responses=True,
            )
        return _sync_redis


def issue_sse_ticket(user_id: UUID) -> tuple[str, int]:
    token = secrets.token_urlsafe(32)
    ttl = _ttl_seconds()
    payload = json.dumps({"user_id": str(user_id)}, ensure_ascii=False)
    client = _get_sync_redis()
    if client is not None:
        client.set(_ticket_key(token), payload, ex=ttl)
    else:
        expires_at = time.time() + ttl
        with _memory_lock:
            _memory_tickets[token] = (str(user_id), expires_at)
    return token, ttl


def validate_sse_ticket(token: str) -> UUID | None:
    raw = (token or "").strip()
    if not raw:
        return None
    ttl = _ttl_seconds()
    client = _get_sync_redis()
    if client is not None:
        key = _ticket_key(raw)
        try:
            payload = client.get(key)
            if not payload:
                return None
            client.expire(key, ttl)
            user_id = json.loads(payload).get("user_id")
            return UUID(str(user_id))
        except Exception:
            logger.exception("sse_ticket_validate_failed")
            return None

    now = time.time()
    with _memory_lock:
        entry = _memory_tickets.get(raw)
        if entry is None:
            return None
        user_id, expires_at = entry
        if expires_at <= now:
            _memory_tickets.pop(raw, None)
            return None
        _memory_tickets[raw] = (user_id, now + ttl)
    try:
        return UUID(user_id)
    except ValueError:
        return None


def reset_sse_ticket_store_for_tests() -> None:
    global _sync_redis
    with _memory_lock:
        _memory_tickets.clear()
    with _sync_redis_lock:
        _sync_redis = None
