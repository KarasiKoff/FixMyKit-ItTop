"""Проверка типов вложений (фото и видео)."""

from __future__ import annotations

from backend.app.core.config import settings

# Ограничение Tracker API (~1024 Mbit в документации ≈ 128 МБ на файл).
TRACKER_ATTACHMENT_MAX_BYTES = 128 * 1024 * 1024

ALLOWED_IMAGE_MIMES = frozenset(
    {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/heic",
        "image/heif",
        "image/bmp",
        "image/tiff",
    }
)
ALLOWED_VIDEO_MIMES = frozenset(
    {
        "video/mp4",
        "video/webm",
        "video/quicktime",
        "video/x-msvideo",
        "video/x-matroska",
        "video/ogg",
    }
)
ALLOWED_IMAGE_EXT = frozenset({".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif", ".bmp", ".tif", ".tiff"})
ALLOWED_VIDEO_EXT = frozenset({".mp4", ".webm", ".mov", ".avi", ".mkv", ".ogv"})


def _ext(name: str) -> str:
    dot = name.rfind(".")
    if dot < 0:
        return ""
    return name[dot:].lower()


def is_allowed_attachment(filename: str, content_type: str | None) -> bool:
    ext = _ext(filename)
    mime = (content_type or "").split(";")[0].strip().lower()
    if mime in ALLOWED_IMAGE_MIMES or mime in ALLOWED_VIDEO_MIMES:
        return True
    if ext in ALLOWED_IMAGE_EXT or ext in ALLOWED_VIDEO_EXT:
        return True
    if mime.startswith("image/") and ext in ALLOWED_IMAGE_EXT:
        return True
    if mime.startswith("video/") and ext in ALLOWED_VIDEO_EXT:
        return True
    return False


def effective_max_attachment_bytes() -> int:
    return min(settings.attachment_max_bytes, TRACKER_ATTACHMENT_MAX_BYTES)


def attachment_kind(filename: str, content_type: str | None) -> str:
    mime = (content_type or "").split(";")[0].strip().lower()
    ext = _ext(filename)
    if mime in ALLOWED_VIDEO_MIMES or ext in ALLOWED_VIDEO_EXT or mime.startswith("video/"):
        return "video"
    return "image"
