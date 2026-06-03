"""Контекст запроса для сквозной трассировки в логах."""

from __future__ import annotations

import contextvars
import uuid

_request_id: contextvars.ContextVar[str | None] = contextvars.ContextVar("request_id", default=None)


def get_request_id() -> str | None:
    return _request_id.get()


def set_request_id(value: str | None) -> contextvars.Token:
    return _request_id.set(value)


def reset_request_id(token: contextvars.Token) -> None:
    _request_id.reset(token)


def new_request_id() -> str:
    return str(uuid.uuid4())
