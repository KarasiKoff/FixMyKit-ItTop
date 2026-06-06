"""Доставка SSE-событий: in-memory (один воркер) или Redis pub/sub."""

from __future__ import annotations

import asyncio
import json
import logging
from threading import Lock

from backend.app.core.config import settings
from backend.app.services.realtime_hub import SseEvent, hub

logger = logging.getLogger(__name__)

_subscriber_task: asyncio.Task | None = None
_sync_redis = None
_sync_redis_lock = Lock()

_PUBSUB_POLL_TIMEOUT_SEC = 1.0
_RECONNECT_BACKOFF_INITIAL_SEC = 1.0
_RECONNECT_BACKOFF_MAX_SEC = 30.0


def _backend() -> str:
    return settings.server.resolved_realtime_backend()


def _channel() -> str:
    return (settings.server.redis_sse_channel or "fixmykit:sse").strip()


def _redis_url() -> str | None:
    url = (settings.server.redis_url or "").strip()
    return url or None


def _get_sync_redis():
    global _sync_redis
    url = _redis_url()
    if url is None:
        return None
    with _sync_redis_lock:
        if _sync_redis is None:
            import redis

            _sync_redis = redis.Redis.from_url(url, decode_responses=True)
        return _sync_redis


def _parse_pubsub_message(message: dict) -> SseEvent | None:
    if message.get("type") != "message":
        return None
    raw = message.get("data")
    if not raw:
        return None
    try:
        payload = json.loads(raw)
        return SseEvent(event=payload["event"], data=payload["data"])
    except json.JSONDecodeError, KeyError, TypeError:
        logger.warning("realtime_redis_invalid_message")
        return None


async def _redis_subscriber_session(channel: str) -> None:
    """Одна сессия pub/sub; отдельное соединение без socket read timeout."""
    from redis.asyncio import Redis

    url = _redis_url()
    if url is None:
        return

    client = Redis.from_url(
        url,
        decode_responses=True,
        socket_timeout=None,
        socket_connect_timeout=5,
    )
    pubsub = client.pubsub(ignore_subscribe_messages=True)
    await pubsub.subscribe(channel)
    logger.info("realtime_redis_subscriber_started", extra={"channel": channel})
    try:
        while True:
            message = await pubsub.get_message(
                ignore_subscribe_messages=True,
                timeout=_PUBSUB_POLL_TIMEOUT_SEC,
            )
            if message is None:
                continue
            event = _parse_pubsub_message(message)
            if event is not None:
                await hub.publish(event)
    finally:
        try:
            await pubsub.unsubscribe(channel)
            await pubsub.aclose()
        except Exception:
            logger.debug("realtime_redis_pubsub_close_failed", exc_info=True)
        try:
            await client.aclose()
        except Exception:
            logger.debug("realtime_redis_client_close_failed", exc_info=True)


async def _redis_subscriber_loop() -> None:
    channel = _channel()
    backoff = _RECONNECT_BACKOFF_INITIAL_SEC
    while True:
        try:
            await _redis_subscriber_session(channel)
            backoff = _RECONNECT_BACKOFF_INITIAL_SEC
        except asyncio.CancelledError:
            logger.debug(
                "realtime_redis_subscriber_stopped", extra={"channel": channel}
            )
            raise
        except Exception:
            logger.warning(
                "realtime_redis_subscriber_reconnecting",
                extra={"channel": channel, "backoff_sec": backoff},
                exc_info=True,
            )
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, _RECONNECT_BACKOFF_MAX_SEC)


async def start_realtime_bus() -> None:
    global _subscriber_task
    if _backend() != "redis":
        return
    if _subscriber_task is not None and not _subscriber_task.done():
        return
    _subscriber_task = asyncio.create_task(
        _redis_subscriber_loop(),
        name="realtime_redis_subscriber",
    )


async def stop_realtime_bus() -> None:
    global _subscriber_task
    task = _subscriber_task
    _subscriber_task = None
    if task is not None:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


def publish_to_bus(event: SseEvent) -> None:
    if _backend() == "redis":
        client = _get_sync_redis()
        if client is None:
            logger.warning("realtime_redis_publish_skipped_no_client")
            return
        body = json.dumps(
            {"event": event.event, "data": event.data},
            ensure_ascii=False,
        )
        try:
            client.publish(_channel(), body)
        except Exception:
            logger.exception("realtime_redis_publish_failed")
        return

    if _main_loop_available():
        _schedule_local_publish(event)


def _main_loop_available() -> bool:
    from backend.app.services.realtime_hub import _main_loop

    return _main_loop is not None


def _schedule_local_publish(event: SseEvent) -> None:
    import asyncio

    from backend.app.services.realtime_hub import _main_loop, _publish_async

    if _main_loop is None:
        return
    try:
        asyncio.run_coroutine_threadsafe(_publish_async(event), _main_loop)
    except RuntimeError:
        logger.debug("realtime_memory_publish_skipped")


def reset_realtime_bus_for_tests() -> None:
    global _sync_redis, _subscriber_task
    _subscriber_task = None
    with _sync_redis_lock:
        _sync_redis = None
