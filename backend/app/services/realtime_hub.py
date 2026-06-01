"""In-memory SSE hub (один процесс uvicorn). Для нескольких воркеров нужен Redis pub/sub."""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)

PING_INTERVAL_SEC = 25.0
QUEUE_MAX = 64

_main_loop: asyncio.AbstractEventLoop | None = None


def bind_main_event_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _main_loop
    _main_loop = loop


def clear_main_event_loop() -> None:
    global _main_loop
    _main_loop = None


@dataclass(frozen=True)
class SseEvent:
    event: str
    data: dict[str, Any]


class RealtimeHub:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[SseEvent | None]] = set()
        self._lock = asyncio.Lock()

    async def subscribe(self) -> asyncio.Queue[SseEvent | None]:
        queue: asyncio.Queue[SseEvent | None] = asyncio.Queue(maxsize=QUEUE_MAX)
        async with self._lock:
            self._subscribers.add(queue)
        return queue

    async def unsubscribe(self, queue: asyncio.Queue[SseEvent | None]) -> None:
        async with self._lock:
            self._subscribers.discard(queue)

    async def publish(self, event: SseEvent) -> None:
        async with self._lock:
            targets = list(self._subscribers)
        for queue in targets:
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                logger.warning("sse subscriber queue full, dropping event")

    async def close_all(self) -> None:
        async with self._lock:
            targets = list(self._subscribers)
            self._subscribers.clear()
        for queue in targets:
            try:
                queue.put_nowait(None)
            except asyncio.QueueFull:
                pass


hub = RealtimeHub()


async def _publish_async(event: SseEvent) -> None:
    await hub.publish(event)


def publish_event(event: str, data: dict[str, Any]) -> None:
    """Вызов из sync-кода (вебхук, API): планирует отправку в asyncio loop"""
    if _main_loop is None:
        return
    payload = SseEvent(event=event, data=data)
    try:
        asyncio.run_coroutine_threadsafe(_publish_async(payload), _main_loop)
    except RuntimeError:
        logger.debug("sse publish skipped: event loop unavailable")


def format_sse_message(event: SseEvent) -> str:
    body = json.dumps(event.data, ensure_ascii=False)
    return f"event: {event.event}\ndata: {body}\n\n"


def format_sse_ping() -> str:
    return "event: ping\ndata: {}\n\n"
