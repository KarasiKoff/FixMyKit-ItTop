"""Временное хранение вложений заявок на диске до синхронизации с Tracker."""

from __future__ import annotations

import re
import shutil
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID, uuid4

from backend.app.core.config import settings

_SAFE_NAME_RE = re.compile(r"[^a-zA-Z0-9._-]+")


@dataclass(frozen=True)
class PendingAttachment:
    stored_name: str
    original_name: str
    path: Path
    size: int
    mimetype: str | None
    created_at: datetime


def upload_root() -> Path:
    root = Path(settings.server.upload_dir).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def pending_root() -> Path:
    path = upload_root() / "pending"
    path.mkdir(parents=True, exist_ok=True)
    return path


def pending_dir(request_id: UUID) -> Path:
    path = pending_root() / str(request_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _sanitize_filename(name: str) -> str:
    base = (name or "file").strip().replace("\\", "/").split("/")[-1]
    base = _SAFE_NAME_RE.sub("_", base).strip("._") or "file"
    return base[:200]


def _parse_stored_name(filename: str) -> tuple[str, str] | None:
    if "_" not in filename:
        return None
    file_id, rest = filename.split("_", 1)
    if len(file_id) != 32:
        return None
    return file_id, rest


def list_pending(request_id: UUID) -> list[PendingAttachment]:
    directory = pending_dir(request_id)
    items: list[PendingAttachment] = []
    for entry in sorted(directory.iterdir()):
        if not entry.is_file():
            continue
        parsed = _parse_stored_name(entry.name)
        original = parsed[1] if parsed else entry.name
        stat = entry.stat()
        items.append(
            PendingAttachment(
                stored_name=entry.name,
                original_name=original,
                path=entry,
                size=stat.st_size,
                mimetype=None,
                created_at=datetime.fromtimestamp(stat.st_mtime, tz=UTC),
            )
        )
    return items


def count_pending(request_id: UUID) -> int:
    directory = pending_dir(request_id)
    return sum(1 for entry in directory.iterdir() if entry.is_file())


def save_pending_file(
    request_id: UUID,
    *,
    original_name: str,
    data: bytes,
    mimetype: str | None = None,
) -> PendingAttachment:
    safe = _sanitize_filename(original_name)
    stored_name = f"{uuid4().hex}_{safe}"
    path = pending_dir(request_id) / stored_name
    path.write_bytes(data)
    stat = path.stat()
    return PendingAttachment(
        stored_name=stored_name,
        original_name=safe,
        path=path,
        size=stat.st_size,
        mimetype=mimetype,
        created_at=datetime.fromtimestamp(stat.st_mtime, tz=UTC),
    )


def delete_pending_file(path: Path) -> None:
    if path.is_file():
        path.unlink(missing_ok=True)


def remove_pending_dir(request_id: UUID) -> None:
    directory = pending_root() / str(request_id)
    if directory.is_dir():
        shutil.rmtree(directory, ignore_errors=True)


def iter_pending_request_dirs() -> list[tuple[UUID | None, Path]]:
    result: list[tuple[UUID | None, Path]] = []
    for entry in pending_root().iterdir():
        if not entry.is_dir():
            continue
        try:
            rid = UUID(entry.name)
        except ValueError:
            result.append((None, entry))
            continue
        result.append((rid, entry))
    return result


def cleanup_directory(path: Path) -> int:
    removed = 0
    if not path.exists():
        return 0
    if path.is_file():
        path.unlink(missing_ok=True)
        return 1
    for child in path.iterdir():
        if child.is_file():
            child.unlink(missing_ok=True)
            removed += 1
        elif child.is_dir():
            removed += cleanup_directory(child)
    try:
        path.rmdir()
    except OSError:
        pass
    return removed


def delete_stale_pending_files(request_id: UUID, *, max_age: timedelta) -> int:
    cutoff = datetime.now(UTC) - max_age
    removed = 0
    for item in list_pending(request_id):
        if item.created_at < cutoff:
            delete_pending_file(item.path)
            removed += 1
    directory = pending_dir(request_id)
    if directory.is_dir() and not any(directory.iterdir()):
        try:
            directory.rmdir()
        except OSError:
            pass
    return removed
