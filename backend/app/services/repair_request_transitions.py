"""Единые правила смены статуса заявки по каналу (API UI vs вебхук Tracker)"""

from __future__ import annotations

from enum import Enum

from backend.app.models.enums import RequestStatus

# Статусы, считающиеся «активной» заявкой
ACTIVE_STATUSES = (
    RequestStatus.OPEN,
    RequestStatus.IN_PROGRESS,
    RequestStatus.NEEDS_INFO,
)

# Переходы из UI/API: закрытую заявку повторно не открываем
_API_TRANSITIONS: dict[RequestStatus, frozenset[RequestStatus]] = {
    RequestStatus.OPEN: frozenset(
        {
            RequestStatus.OPEN,
            RequestStatus.IN_PROGRESS,
            RequestStatus.NEEDS_INFO,
            RequestStatus.CLOSED,
        }
    ),
    RequestStatus.IN_PROGRESS: frozenset(
        {
            RequestStatus.IN_PROGRESS,
            RequestStatus.NEEDS_INFO,
            RequestStatus.CLOSED,
        }
    ),
    RequestStatus.NEEDS_INFO: frozenset(
        {
            RequestStatus.NEEDS_INFO,
            RequestStatus.IN_PROGRESS,
            RequestStatus.CLOSED,
        }
    ),
    RequestStatus.CLOSED: frozenset({RequestStatus.CLOSED}),
}

# Вебхук Tracker: допускает переоткрытие и смену из закрытого
_WEBHOOK_TRANSITIONS: dict[RequestStatus, frozenset[RequestStatus]] = {
    RequestStatus.OPEN: frozenset(
        {
            RequestStatus.OPEN,
            RequestStatus.IN_PROGRESS,
            RequestStatus.NEEDS_INFO,
            RequestStatus.CLOSED,
        }
    ),
    RequestStatus.IN_PROGRESS: frozenset(
        {
            RequestStatus.OPEN,
            RequestStatus.IN_PROGRESS,
            RequestStatus.NEEDS_INFO,
            RequestStatus.CLOSED,
        }
    ),
    RequestStatus.NEEDS_INFO: frozenset(
        {
            RequestStatus.OPEN,
            RequestStatus.IN_PROGRESS,
            RequestStatus.NEEDS_INFO,
            RequestStatus.CLOSED,
        }
    ),
    RequestStatus.CLOSED: frozenset(
        {
            RequestStatus.OPEN,
            RequestStatus.IN_PROGRESS,
            RequestStatus.NEEDS_INFO,
            RequestStatus.CLOSED,
        }
    ),
}


class TransitionSource(str, Enum):
    API = "api"
    WEBHOOK = "webhook"


def allowed_targets(
    from_status: RequestStatus, source: TransitionSource
) -> frozenset[RequestStatus]:
    table = (
        _WEBHOOK_TRANSITIONS if source is TransitionSource.WEBHOOK else _API_TRANSITIONS
    )
    return table[from_status]


def can_transition(
    from_status: RequestStatus,
    to_status: RequestStatus,
    source: TransitionSource,
) -> bool:
    return to_status in allowed_targets(from_status, source)


def assert_can_transition(
    from_status: RequestStatus,
    to_status: RequestStatus,
    source: TransitionSource,
) -> None:
    if not can_transition(from_status, to_status, source):
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="invalid_status_transition",
        )
