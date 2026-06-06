"""Маскировка чувствительных query-параметров в логах."""

from __future__ import annotations

import re
from urllib.parse import parse_qsl, urlencode

_SENSITIVE_QUERY_KEYS = frozenset({"sse_token", "access_token"})

_MASK = "***"


def sanitize_query_string(query: str | None) -> str:
    if not query:
        return ""
    pairs = parse_qsl(query, keep_blank_values=True)
    if not pairs:
        return ""
    masked: list[tuple[str, str]] = []
    for key, value in pairs:
        if key in _SENSITIVE_QUERY_KEYS and value:
            masked.append((key, _MASK))
        else:
            masked.append((key, value))
    return urlencode(masked)


def sanitize_request_uri(path: str, query: str | None) -> str:
    safe_query = sanitize_query_string(query)
    if not safe_query:
        return path
    return f"{path}?{safe_query}"


_RE_SSE_TOKEN = re.compile(r"([?&]sse_token=)[^&]*", re.IGNORECASE)
_RE_ACCESS_TOKEN = re.compile(r"([?&]access_token=)[^&]*", re.IGNORECASE)


def sanitize_uri_string(uri: str) -> str:
    """Для nginx map или произвольных URI-строк."""
    out = _RE_SSE_TOKEN.sub(rf"\1{_MASK}", uri)
    return _RE_ACCESS_TOKEN.sub(rf"\1{_MASK}", out)
