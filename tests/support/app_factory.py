"""Тестовое FastAPI-приложение без фоновых задач lifespan."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend.app.api.router import api_router


@asynccontextmanager
async def _test_lifespan(_app: FastAPI):
    yield


def create_test_app() -> FastAPI:
    app = FastAPI(title="Fix My Kit API (tests)", lifespan=_test_lifespan)
    app.include_router(api_router)
    return app
