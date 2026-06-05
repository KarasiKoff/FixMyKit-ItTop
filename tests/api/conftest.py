"""Фикстуры API-тестов: PostgreSQL, TestClient, пользователи, моки Tracker."""

from __future__ import annotations

from collections.abc import Generator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from backend.app.api.deps import get_db
from backend.app.core.security import create_access_token, hash_password
from backend.app.models import Base
from backend.app.models.audience import Audience
from backend.app.models.device import Device
from backend.app.models.enums import UserRole
from backend.app.models.user import User
from backend.app.repositories.audience_repository import AudienceRepository
from backend.app.repositories.device_repository import DeviceRepository
from backend.app.repositories.user_repository import UserRepository
from tests.support.app_factory import create_test_app

pytestmark = pytest.mark.integration


def _database_url() -> str:
    from backend.app.core.config import settings

    return settings.database.database_url


@pytest.fixture(scope="session")
def engine():
    eng = create_engine(_database_url(), pool_pre_ping=True)
    try:
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
    except OSError as exc:
        pytest.skip(f"PostgreSQL недоступен: {exc}")
    except Exception as exc:
        pytest.skip(f"PostgreSQL недоступен: {exc}")

    Base.metadata.drop_all(eng)
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)


@pytest.fixture(scope="session")
def session_factory(engine):
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def seed_static_users(session_factory) -> None:
    with session_factory() as db:
        repo = UserRepository(db)
        if repo.get_by_login("admin") is None:
            repo.create(
                User(
                    login="admin",
                    password_hash=hash_password("admin"),
                    role=UserRole.ADMIN,
                    full_name="Test Admin",
                    is_active=True,
                )
            )
        login = "tracker_webhook"
        if repo.get_by_login(login) is None:
            repo.create(
                User(
                    login=login,
                    password_hash=hash_password("unused"),
                    role=UserRole.SYSADMIN,
                    full_name="Tracker Webhook",
                    is_active=True,
                )
            )


@pytest.fixture()
def db(session_factory) -> Generator[Session, None, None]:
    with session_factory() as session:
        yield session
        session.rollback()


@pytest.fixture()
def fake_tracker_client(monkeypatch: pytest.MonkeyPatch):
    """FakeTrackerClient + подмена get_tracker_issue_service."""
    from tests.support.fake_tracker_client import (
        patch_tracker_issue_service,
        tracker_create_issue_client,
    )

    return patch_tracker_issue_service(monkeypatch, tracker_create_issue_client())


@pytest.fixture()
def failing_tracker_client(monkeypatch: pytest.MonkeyPatch):
    from tests.support.fake_tracker_client import (
        patch_tracker_issue_service,
        tracker_failing_client,
    )

    return patch_tracker_issue_service(monkeypatch, tracker_failing_client())


@pytest.fixture(autouse=True)
def _mock_tracker_outbound(
    monkeypatch: pytest.MonkeyPatch, request: pytest.FixtureRequest
) -> None:
    """Исходящие вызовы Tracker: noop, кроме тестов с marker tracker_http."""
    from backend.app.models.repair_request import RepairRequest

    tracker_http = request.node.get_closest_marker("tracker_http") is not None

    def _allow_workflow_without_ticket(repair_request: RepairRequest) -> str:
        return (
            repair_request.tracker_ticket_key or repair_request.tracker_ticket_id or ""
        ).strip() or "FIXMYKIT-TEST"

    monkeypatch.setattr(
        "backend.app.services.repair_request_actions_service.require_tracker_ticket",
        _allow_workflow_without_ticket,
    )

    def _noop_sync_label(
        db: Session, repair_request: RepairRequest, label: str, **kwargs
    ) -> None:
        repair_request.tracker_status_label = label
        repair_request.tracker_status_sync_pending = False
        db.commit()

    monkeypatch.setattr(
        "backend.app.services.repair_request_workflow_service.sync_tracker_label_with_pending",
        _noop_sync_label,
    )
    monkeypatch.setattr(
        "backend.app.services.repair_request_tracker_outbound.sync_tracker_label_with_pending",
        _noop_sync_label,
    )

    if tracker_http:
        from tests.support.fake_tracker_client import enable_real_try_tracker_sync

        enable_real_try_tracker_sync(monkeypatch)
    else:

        def _noop_try_sync(request_id) -> None:
            return None

        monkeypatch.setattr(
            "backend.app.services.repair_request_create_service.try_tracker_sync",
            _noop_try_sync,
        )

    monkeypatch.setattr(
        "backend.app.services.repair_request_webhook_service.post_issue_comment",
        lambda *args, **kwargs: None,
    )
    monkeypatch.setattr(
        "backend.app.services.repair_request_comment_service.sync_user_comment_to_tracker",
        lambda *args, **kwargs: None,
    )
    monkeypatch.setattr(
        "backend.app.services.repair_request_workflow_service.sync_resolution_comment_to_tracker",
        lambda *args, **kwargs: None,
    )


@pytest.fixture()
def client(db: Session) -> Generator[TestClient, None, None]:
    app = create_test_app()

    def override_get_db() -> Generator[Session, None, None]:
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def admin_user(db: Session) -> User:
    user = UserRepository(db).get_by_login("admin")
    assert user is not None
    return user


@pytest.fixture()
def sysadmin_user(db: Session) -> User:
    login = "sysadmin_test"
    repo = UserRepository(db)
    user = repo.get_by_login(login)
    if user is None:
        user = repo.create(
            User(
                login=login,
                password_hash=hash_password("sysadmin"),
                role=UserRole.SYSADMIN,
                full_name="Test Sysadmin",
                is_active=True,
            )
        )
    return user


@pytest.fixture()
def sysadmin_headers(sysadmin_user: User) -> dict[str, str]:
    token = create_access_token(str(sysadmin_user.id))
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def admin_headers(admin_user: User) -> dict[str, str]:
    token = create_access_token(str(admin_user.id))
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def device(db: Session, audience: Audience) -> Device:
    return DeviceRepository(db).save_new(
        Device(
            inventory_number=f"INV-{uuid4().hex[:8]}",
            name="Тестовое устройство",
            audience_id=audience.id,
        )
    )


@pytest.fixture()
def audience(db: Session) -> Audience:
    return AudienceRepository(db).create(f"Кабинет-{uuid4().hex[:8]}")


@pytest.fixture()
def webhook_headers() -> dict[str, str]:
    return {"X-Tracker-Webhook-Secret": "test-webhook-secret"}
