"""Shared FastAPI dependencies — settings, current user, etc."""

from functools import lru_cache
from typing import Annotated

from fastapi import Depends, Header
from sqlmodel.ext.asyncio.session import AsyncSession

from noozha.api.controllers.auth import AuthController
from noozha.api.models.table import AdminUser
from noozha.api.schemas.error import MissingTokenError
from noozha.database import get_session
from noozha.settings import Settings


@lru_cache
def get_settings() -> Settings:
    """Memoized settings (one instance per process)."""
    return Settings()  # ty: ignore[missing-argument]


# Re-usable Annotated aliases to keep route signatures tight.
SessionDep = Annotated[AsyncSession, Depends(get_session)]
SettingsDep = Annotated[Settings, Depends(get_settings)]


async def get_current_admin(
    session: SessionDep,
    settings: SettingsDep,
    authorization: Annotated[str | None, Header()] = None,
) -> AdminUser:
    """Resolve the admin user from the `Authorization: Bearer <token>` header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise MissingTokenError
    token = authorization.removeprefix("Bearer ").strip()
    user_id = AuthController.decode_token(token, settings)
    return await AuthController.get_user_by_id(user_id, session)


AdminDep = Annotated[AdminUser, Depends(get_current_admin)]
