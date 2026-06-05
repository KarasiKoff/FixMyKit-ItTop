"""Эндпоинт /metrics для Prometheus."""

from fastapi.testclient import TestClient

from backend.app.core.metrics import setup_metrics
from tests.support.app_factory import create_test_app


def test_metrics_endpoint_returns_prometheus_text() -> None:
    app = create_test_app()
    setup_metrics(app)
    client = TestClient(app)

    response = client.get("/metrics")

    assert response.status_code == 200
    assert "text/plain" in response.headers.get("content-type", "")
    assert "http_requests" in response.text or "python_info" in response.text
