"""Чтение файлов логов для админ-UI."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Literal

LogSource = Literal["app", "error"]
LogLevelFilter = Literal["ALL", "INFO", "WARNING", "ERROR", "CRITICAL", "DEBUG"]


def _log_files(log_dir: Path) -> dict[LogSource, Path]:
    return {
        "app": log_dir / "fixmykit.log",
        "error": log_dir / "fixmykit-error.log",
    }


def _parse_line(raw: str) -> dict[str, Any]:
    line = raw.strip()
    if not line:
        return {"raw": "", "level": "INFO", "message": ""}
    try:
        data = json.loads(line)
        if isinstance(data, dict):
            return {
                "ts": data.get("ts"),
                "level": str(data.get("level", "INFO")),
                "logger": data.get("logger"),
                "message": str(data.get("message", "")),
                "request_id": data.get("request_id"),
                "exception": data.get("exception"),
                "extra": {
                    k: v
                    for k, v in data.items()
                    if k
                    not in {
                        "ts",
                        "level",
                        "logger",
                        "message",
                        "request_id",
                        "exception",
                    }
                },
                "raw": line,
            }
    except json.JSONDecodeError:
        pass
    return {"raw": line, "level": "INFO", "message": line}


def _level_matches(level: str, flt: LogLevelFilter) -> bool:
    if flt == "ALL":
        return True
    order = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
    try:
        return order.index(level.upper()) >= order.index(flt)
    except ValueError:
        return True


def tail_log_entries(
    log_dir: Path,
    *,
    source: LogSource = "app",
    limit: int = 200,
    level: LogLevelFilter = "ALL",
    search: str | None = None,
) -> list[dict[str, Any]]:
    path = _log_files(log_dir).get(source)
    if path is None or not path.is_file():
        return []

    limit = max(1, min(limit, 1000))
    needle = (search or "").strip().lower()

    with path.open("r", encoding="utf-8", errors="replace") as fh:
        lines = fh.readlines()

    entries: list[dict[str, Any]] = []
    for raw in reversed(lines):
        if not raw.strip():
            continue
        entry = _parse_line(raw)
        lvl = str(entry.get("level", "INFO")).upper()
        if not _level_matches(lvl, level):
            continue
        if needle:
            blob = json.dumps(entry, ensure_ascii=False).lower()
            if needle not in blob:
                continue
        entries.append(entry)
        if len(entries) >= limit:
            break

    def _ts_key(e: dict[str, Any]) -> str:
        ts = e.get("ts")
        return "" if ts is None else str(ts)

    entries.sort(key=_ts_key, reverse=True)
    return entries


def log_sources_status(log_dir: Path) -> dict[str, Any]:
    files = _log_files(log_dir)
    out: dict[str, Any] = {"log_dir": str(log_dir.resolve())}
    for key, path in files.items():
        if path.is_file():
            stat = path.stat()
            out[key] = {
                "exists": True,
                "size_bytes": stat.st_size,
                "modified_at": stat.st_mtime,
            }
        else:
            out[key] = {"exists": False, "size_bytes": 0}
    return out
