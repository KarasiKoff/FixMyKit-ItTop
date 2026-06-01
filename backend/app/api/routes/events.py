"""Server-Sent Events для админского UI"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from backend.app.api.deps import require_admin_or_sysadmin_from_token
from backend.app.models.user import User
from backend.app.services.realtime_hub import (
    PING_INTERVAL_SEC,
    format_sse_message,
    format_sse_ping,
    hub,
)

router = APIRouter(prefix="/api/events", tags=["events"])


async def _sse_stream(
    *,
    repair_request_id: str | None,
) -> AsyncIterator[str]:
    queue = await hub.subscribe()
    try:
        yield format_sse_ping()
        while True:
            try:
                item = await asyncio.wait_for(queue.get(), timeout=PING_INTERVAL_SEC)
            except asyncio.TimeoutError:
                yield format_sse_ping()
                continue
            if item is None:
                break
            if repair_request_id:
                rid = item.data.get("repair_request_id")
                if rid and str(rid) != repair_request_id:
                    continue
            yield format_sse_message(item)
    finally:
        await hub.unsubscribe(queue)


@router.get(
    "/stream",
    summary="SSE: изменения заявок на ремонт",
    description=(
        "Поток событий для авторизованных admin/sysadmin. "
        "Токен: query `access_token` (JWT), т.к. EventSource не шлёт Authorization. "
        "Опционально `repair_request_id` — только события по одной заявке."
    ),
)
async def repair_requests_event_stream(
    _: User = Depends(require_admin_or_sysadmin_from_token),
    repair_request_id: Annotated[str | None, Query()] = None,
) -> StreamingResponse:
    rid = (repair_request_id or "").strip() or None
    generator = _sse_stream(repair_request_id=rid)
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
