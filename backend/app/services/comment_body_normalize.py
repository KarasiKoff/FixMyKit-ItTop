"""Очистка текста комментария (HTML/сущности из Yandex Tracker)."""

from __future__ import annotations

import html
import re

_BR_RE = re.compile(r"<br\s*/?>", re.IGNORECASE)
_TAG_RE = re.compile(r"<[^>]+>")
_LEGACY_AUTHOR_PREFIX_RE = re.compile(r"^\*\*([^*]+)\*\*:\s*\n+", re.MULTILINE)


def normalize_comment_body(text: str) -> str:
    s = html.unescape((text or "").strip())
    s = s.replace("\xa0", " ")
    s = _BR_RE.sub("\n", s)
    s = _TAG_RE.sub("", s)
    s = s.replace("&nbsp;", " ")
    lines = [line.rstrip() for line in s.splitlines()]
    return "\n".join(lines).strip()


def plain_author_prefix_body(text: str, author_label: str) -> str:
    body = normalize_comment_body(text)
    label = author_label.strip()
    if not label:
        return body
    return f"{label}:\n\n{body}"


def strip_plain_author_prefix(text: str, author_label: str) -> str:
    body = (text or "").strip()
    label = author_label.strip()
    prefix = f"{label}:\n\n"
    if label and body.startswith(prefix):
        return body[len(prefix) :].strip()
    return body


def inbound_tracker_comment_display(
    author_login: str | None,
    author_full_name: str | None,
    body: str,
    *,
    webhook_actor_login: str,
) -> tuple[str | None, str]:
    """Имя автора и текст без префикса для комментариев из webhook трекера."""
    normalized = normalize_comment_body(body)
    login = (author_login or "").strip()
    if login and login == webhook_actor_login:
        m = re.match(r"^([^:\n]{1,200}):\n\n", normalized, re.DOTALL)
        if m:
            label = m.group(1).strip()
            if label:
                return label, strip_plain_author_prefix(normalized, label)
    display = (author_full_name or "").strip() or login or None
    return display, normalized


def legacy_markdown_author_to_plain(text: str) -> str:
    """Старые импорты с **Имя**: → обычный «Имя:\\n\\nтекст»."""
    m = _LEGACY_AUTHOR_PREFIX_RE.match(text)
    if not m:
        return text
    name = m.group(1).strip()
    rest = text[m.end() :].strip()
    return plain_author_prefix_body(rest, name) if name else rest
