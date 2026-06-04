"""Нормализация текста комментариев из Tracker."""

from __future__ import annotations

from backend.app.services.comment_body_normalize import (
    legacy_markdown_author_to_plain,
    normalize_comment_body,
    plain_author_prefix_body,
)


class TestNormalizeCommentBody:
    def test_strips_html_tags_and_br(self) -> None:
        raw = "<p>Строка&nbsp;один</p><br/>Строка два"
        assert normalize_comment_body(raw) == "Строка один\nСтрока два"

    def test_unescapes_entities(self) -> None:
        assert normalize_comment_body("Tom &amp; Jerry") == "Tom & Jerry"

    def test_empty_and_whitespace(self) -> None:
        assert normalize_comment_body("") == ""
        assert normalize_comment_body("   \n  ") == ""


class TestPlainAuthorPrefixBody:
    def test_adds_author_label(self) -> None:
        assert plain_author_prefix_body("текст", "Иван") == "Иван:\n\nтекст"

    def test_skips_empty_label(self) -> None:
        assert plain_author_prefix_body("текст", "  ") == "текст"


class TestLegacyMarkdownAuthor:
    def test_converts_bold_prefix(self) -> None:
        raw = "**Сисадмин**:\n\nКомментарий"
        assert legacy_markdown_author_to_plain(raw) == "Сисадмин:\n\nКомментарий"

    def test_leaves_plain_text(self) -> None:
        text = "Обычный комментарий"
        assert legacy_markdown_author_to_plain(text) == text
