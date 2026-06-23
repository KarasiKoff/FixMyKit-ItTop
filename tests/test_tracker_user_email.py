"""Сопоставление пользователя с автором webhook трекера."""

from __future__ import annotations

from backend.app.services.comment_body_normalize import inbound_tracker_comment_display


def test_inbound_comment_display_strips_webhook_prefix() -> None:
    name, body = inbound_tracker_comment_display(
        "tracker_webhook",
        "Jira",
        "Никита Володин:\n\ntesttest",
        webhook_actor_login="tracker_webhook",
    )
    assert name == "Никита Володин"
    assert body == "testtest"


def test_inbound_comment_display_real_user() -> None:
    name, body = inbound_tracker_comment_display(
        "admin",
        "Admin User",
        "hello",
        webhook_actor_login="tracker_webhook",
    )
    assert name == "Admin User"
    assert body == "hello"
