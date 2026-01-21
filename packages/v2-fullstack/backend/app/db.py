"""
Database session management (Async SQLAlchemy 2.0).

This module provides:
- Async engine (lazy)
- async_sessionmaker
- FastAPI dependency `get_session`

Notes:
- Uses DATABASE_URL from environment (.env), defaulting to env.example local dev URL.
- Does not connect until a session is actually used.
"""

from __future__ import annotations

from functools import lru_cache
from typing import AsyncIterator

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Matches `packages/v2-fullstack/env.example`
    database_url: str = "postgresql+asyncpg://igloo:igloo_dev@localhost:5432/igloo_index"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


@lru_cache(maxsize=1)
def get_engine() -> AsyncEngine:
    settings = get_settings()
    return create_async_engine(settings.database_url, pool_pre_ping=True)


@lru_cache(maxsize=1)
def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(get_engine(), expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    """
    FastAPI dependency that yields an AsyncSession.
    """
    session_maker = get_sessionmaker()
    async with session_maker() as session:
        yield session


async def dispose_engine() -> None:
    """
    Dispose the global engine (use on FastAPI shutdown).
    """
    engine = get_engine()
    await engine.dispose()
