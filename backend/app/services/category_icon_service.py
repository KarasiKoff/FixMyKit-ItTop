"""Validate and minimally sanitize uploaded category icons."""

from __future__ import annotations

import re

MAX_ICON_BYTES = 1_048_576  # 1 MiB

_ALLOWED_MIMES = frozenset(
    {
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/svg+xml",
    },
)


def _strip_svg_scripts_and_handlers(raw: bytes) -> bytes:
    text = raw.decode("utf-8", errors="replace")
    text = re.sub(r"<script[\s\S]*?</script>", "", text, flags=re.IGNORECASE)
    text = re.sub(r"<\s*script\b[^>]*>", "", text, flags=re.IGNORECASE)
    text = re.sub(
        r"\s+on[a-zA-Z_]+\s*=\s*(\"[^\"]*\"|'[^']*'|[^\s>]+)",
        "",
        text,
    )
    text = re.sub(r"javascript\s*:", "", text, flags=re.IGNORECASE)
    return text.encode("utf-8")


def _sniff_mime(data: bytes) -> str | None:
    if len(data) >= 3 and data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if len(data) >= 8 and data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    head = data[:4096].lstrip(b"\xef\xbb\xbf")
    low = head.lower()
    if b"<svg" in low or (low.strip().startswith(b"<?xml") and b"<svg" in low):
        return "image/svg+xml"
    return None


def validate_and_prepare_icon(file_bytes: bytes) -> tuple[str, bytes]:
    if len(file_bytes) > MAX_ICON_BYTES:
        raise ValueError("icon_too_large")

    mime = _sniff_mime(file_bytes)
    if mime is None or mime not in _ALLOWED_MIMES:
        raise ValueError("icon_invalid_type")

    if mime == "image/svg+xml":
        file_bytes = _strip_svg_scripts_and_handlers(file_bytes)
        if len(file_bytes) > MAX_ICON_BYTES:
            raise ValueError("icon_too_large")

    return mime, file_bytes
