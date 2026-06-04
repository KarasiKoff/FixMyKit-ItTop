"""Валидация apply_workflow_change до обращения к БД/Tracker."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from backend.app.models.enums import RequestStatus
from backend.app.services.repair_request_workflow_service import apply_workflow_change


def _request_stub(**overrides: object) -> SimpleNamespace:
    base = {
        "id": uuid4(),
        "device_id": None,
        "status": RequestStatus.OPEN,
        "tracker_status_label": "Открыт",
        "tracker_status_sync_pending": False,
        "closed_at": None,
        "closed_by_user_id": None,
        "resolution_note": None,
        "resolution_desc": None,
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def _actor_stub() -> SimpleNamespace:
    return SimpleNamespace(id=uuid4(), login="admin")


class TestApplyWorkflowValidation:
    def test_needs_info_requires_comment(self) -> None:
        with pytest.raises(HTTPException) as exc:
            apply_workflow_change(
                MagicMock(),
                _request_stub(),
                _actor_stub(),
                "needs_info",
                comment="",
            )
        assert exc.value.status_code == 400
        assert exc.value.detail == "comment_required_for_needs_info"

    def test_closed_requires_resolution(self) -> None:
        with pytest.raises(HTTPException) as exc:
            apply_workflow_change(
                MagicMock(),
                _request_stub(),
                _actor_stub(),
                "closed",
                comment="готово",
            )
        assert exc.value.status_code == 400
        assert exc.value.detail == "resolution_required_for_close"
