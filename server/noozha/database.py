"""Async SQLAlchemy engine + per-request session DI.

Mirrors the LaTabdhir pattern: one shared `AsyncEngine` singleton per process,
sessions yielded via `get_session`, and `create_db_and_tables` runs `SQLModel.metadata.create_all`
at app startup (no Alembic for this small scope; reseed if you change a column).
"""

from collections.abc import AsyncGenerator
from typing import Any

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlalchemy.pool import AsyncAdaptedQueuePool
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from noozha.settings import Settings

_PG_SERVER_SETTINGS = {
    # Abort any single statement that runs longer than 30s.
    "statement_timeout": "30000",
    # Release a connection that's been idle inside a transaction for >60s.
    "idle_in_transaction_session_timeout": "60000",
    "application_name": "noozha-api",
}

_engine: AsyncEngine | None = None


async def create_app_engine(settings: Settings) -> AsyncEngine:
    """Build the AsyncEngine for the long-lived API process."""
    is_postgres = settings.database_url.startswith(("postgresql", "postgres"))
    connect_args: dict[str, Any] = (
        {"server_settings": _PG_SERVER_SETTINGS, "statement_cache_size": 0}
        if is_postgres
        else {}
    )

    return create_async_engine(
        settings.database_url,
        poolclass=AsyncAdaptedQueuePool,
        pool_size=5,
        max_overflow=5,
        pool_timeout=30,
        pool_recycle=3600,
        pool_pre_ping=True,
        echo=False,
        connect_args=connect_args,
    )


async def get_engine() -> AsyncEngine:
    """Return the shared async engine (lazy singleton)."""
    global _engine  # noqa: PLW0603 — one shared AsyncEngine per process
    if _engine is None:
        _engine = await create_app_engine(Settings())  # ty: ignore[missing-argument]
    return _engine


async def get_session(
    engine: AsyncEngine = Depends(get_engine),
) -> AsyncGenerator[AsyncSession, Any]:
    """FastAPI dependency: yield a transaction-aware async session per request."""
    async with AsyncSession(engine, expire_on_commit=False) as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_db_and_tables(engine: AsyncEngine) -> None:
    """Idempotent `create_all`. Safe to call on every boot."""
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
