"""ADF-описание и метки задачи Jira."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from backend.app.core.config import ServerConfig
from backend.app.integrations.jira.issue_description import (
    build_issue_summary,
    build_repair_request_description_adf,
    default_issue_labels,
)


def _device_request(**overrides: object) -> SimpleNamespace:
    base = {
        "id": "92e33a0e-53d5-4d63-9648-f0ab738f889b",
        "device_id": "19105218-0b53-4acc-8f69-8fa8de1f41c4",
        "audience_id": None,
        "author_user_id": "user-1",
        "applicant_name": None,
        "description": "test",
        "device": SimpleNamespace(
            name="301-1",
            inventory_number="301-1",
            audience=SimpleNamespace(name="301"),
        ),
        "audience": None,
        "author": SimpleNamespace(full_name=None, login="admin", id="user-1"),
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def _adf_text_nodes(doc: dict) -> list[str]:
    texts: list[str] = []

    def walk(node: object) -> None:
        if isinstance(node, dict):
            if node.get("type") == "text":
                texts.append(str(node.get("text", "")))
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(doc)
    return texts


class TestDefaultIssueLabels:
    def test_default_fmk(self) -> None:
        assert default_issue_labels() == ["fmk"]

    def test_custom_single(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(
            "backend.app.integrations.jira.issue_description.settings.server",
            ServerConfig(JIRA_ISSUE_LABEL="custom"),
        )
        assert default_issue_labels() == ["custom"]

    def test_comma_separated(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(
            "backend.app.integrations.jira.issue_description.settings.server",
            ServerConfig(JIRA_ISSUE_LABEL="fmk, repair"),
        )
        assert default_issue_labels() == ["fmk", "repair"]

    def test_empty_label(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(
            "backend.app.integrations.jira.issue_description.settings.server",
            ServerConfig(JIRA_ISSUE_LABEL=""),
        )
        assert default_issue_labels() == []


class TestBuildIssueSummary:
    def test_device_summary(self) -> None:
        rr = _device_request()
        assert build_issue_summary(rr) == "Ремонт: 301-1, кабинет 301"

    def test_cabinet_summary(self) -> None:
        rr = SimpleNamespace(
            audience_id="aud-1",
            audience=SimpleNamespace(name="101"),
            device=None,
            device_id=None,
        )
        assert build_issue_summary(rr) == "Кабинет: 101"


class TestBuildRepairRequestDescriptionAdf:
    def test_adf_structure_for_device(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(
            "backend.app.integrations.jira.issue_description.settings.server",
            ServerConfig(PUBLIC_FRONTEND_BASE_URL="https://fixmykit.local"),
        )
        doc = build_repair_request_description_adf(_device_request())
        assert doc["type"] == "doc"
        assert doc["version"] == 1

        headings = [
            node["content"][0]["text"]
            for node in doc["content"]
            if node.get("type") == "heading"
        ]
        assert headings == [
            "Устройство",
            "Заявитель",
            "Описание проблемы",
            "Fix My Kit",
            "Отладка",
        ]

        texts = _adf_text_nodes(doc)
        assert "301-1" in texts
        assert "301" in texts
        assert "admin" in texts
        assert "test" in texts
        assert "Открыть заявку на сайте" in texts
        assert "https://fixmykit.local/requests/92e33a0e-53d5-4d63-9648-f0ab738f889b" in texts
        assert "92e33a0e-53d5-4d63-9648-f0ab738f889b" in texts

        link_nodes = [
            mark
            for node in doc["content"]
            if node.get("type") == "paragraph"
            for item in node.get("content", [])
            if item.get("type") == "text"
            for mark in item.get("marks", [])
            if mark.get("type") == "link"
        ]
        assert link_nodes
        assert link_nodes[0]["attrs"]["href"].endswith(
            "/requests/92e33a0e-53d5-4d63-9648-f0ab738f889b"
        )
