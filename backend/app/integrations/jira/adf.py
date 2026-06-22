"""Atlassian Document Format (ADF) для Jira REST API v3."""

from __future__ import annotations


def plain_text_adf(text: str) -> dict:
    """Преобразует plain text / простой markdown в ADF-документ."""
    body = (text or "").strip()
    if not body:
        return {
            "type": "doc",
            "version": 1,
            "content": [{"type": "paragraph", "content": [{"type": "text", "text": ""}]}],
        }

    blocks = body.split("\n\n")
    content: list[dict] = []
    for block in blocks:
        lines = block.split("\n")
        inline: list[dict] = []
        for index, line in enumerate(lines):
            if index > 0:
                inline.append({"type": "hardBreak"})
            stripped = line.strip()
            if stripped.startswith("### "):
                content.append(
                    {
                        "type": "heading",
                        "attrs": {"level": 3},
                        "content": [{"type": "text", "text": stripped[4:].strip()}],
                    }
                )
                inline = []
                continue
            if stripped.startswith("- "):
                content.append(
                    {
                        "type": "bulletList",
                        "content": [
                            {
                                "type": "listItem",
                                "content": [
                                    {
                                        "type": "paragraph",
                                        "content": [
                                            {"type": "text", "text": stripped[2:].strip()}
                                        ],
                                    }
                                ],
                            }
                        ],
                    }
                )
                inline = []
                continue
            if stripped.startswith("> "):
                inline.append({"type": "text", "text": stripped[2:]})
            elif "**" in stripped:
                _append_bold_runs(inline, stripped)
            else:
                inline.append({"type": "text", "text": line})
        if inline:
            content.append({"type": "paragraph", "content": inline})

    if not content:
        content = [{"type": "paragraph", "content": [{"type": "text", "text": body}]}]
    return {"type": "doc", "version": 1, "content": content}


def _append_bold_runs(inline: list[dict], text: str) -> None:
    parts = text.split("**")
    for index, part in enumerate(parts):
        if not part:
            continue
        if index % 2 == 1:
            inline.append({"type": "text", "text": part, "marks": [{"type": "strong"}]})
        else:
            inline.append({"type": "text", "text": part})
