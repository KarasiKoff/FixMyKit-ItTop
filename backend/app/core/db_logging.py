"""Логирование событий SQLAlchemy / PostgreSQL."""

from __future__ import annotations

import logging

from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger("fixmykit.db")


def install_db_logging(engine: Engine) -> None:
    @event.listens_for(engine, "connect")
    def on_connect(dbapi_connection, connection_record) -> None:
        logger.debug("db_connect", extra={"driver": dbapi_connection.__class__.__module__})

    @event.listens_for(engine, "checkout")
    def on_checkout(dbapi_connection, connection_record, connection_proxy) -> None:
        logger.debug("db_pool_checkout")

    @event.listens_for(engine, "checkin")
    def on_checkin(dbapi_connection, connection_record) -> None:
        logger.debug("db_pool_checkin")

    @event.listens_for(engine, "handle_error")
    def on_handle_error(exception_context) -> None:
        exc = exception_context.original_exception
        if isinstance(exc, SQLAlchemyError):
            logger.error(
                "db_error",
                extra={
                    "statement": (exception_context.statement or "")[:500],
                    "error": str(exc)[:500],
                },
            )
        else:
            logger.exception(
                "db_unexpected_error",
                extra={"statement": (exception_context.statement or "")[:500]},
            )
