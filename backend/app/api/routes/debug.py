"""Тестовые эндпоинты (только dev, когда включена документация API)."""

from fastapi import APIRouter, HTTPException, status

from backend.app.core.config import settings

router = APIRouter(prefix="/api/debug", tags=["debug"])


@router.get("/test-400", include_in_schema=settings.server.api_docs_enabled)
def debug_test_400() -> None:
    """Намеренный 400 для проверки Prometheus/Grafana (status=4xx)."""
    if not settings.server.api_docs_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="debug_400_test",
    )


@router.get("/test-500", include_in_schema=settings.server.api_docs_enabled)
def debug_test_500() -> None:
    """Намеренный 500 для проверки Prometheus/Grafana (status=5xx)."""
    if not settings.server.api_docs_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="debug_500_test",
    )
