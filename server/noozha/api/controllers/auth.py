"""Auth controller — login + user lookup. Routes call these methods only."""

from uuid import UUID

import jwt
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from noozha.api.models.table import AdminUser
from noozha.api.schemas.auth import LoginRequest, TokenResponse
from noozha.api.schemas.error import (
    AdminUserNotFoundError,
    InvalidCredentialsError,
    InvalidTokenError,
)
from noozha.api.utils.auth import (
    create_access_token,
    decode_access_token,
    verify_password,
)
from noozha.settings import Settings


class AuthController:
    """All DB + JWT work for authentication."""

    @staticmethod
    async def login(
        payload: LoginRequest, session: AsyncSession, settings: Settings
    ) -> TokenResponse:
        """Verify credentials and return a fresh access token."""
        result = await session.exec(
            select(AdminUser).where(AdminUser.email == payload.email.lower())
        )
        user = result.first()
        if user is None or not verify_password(payload.password, user.password_hash):
            raise InvalidCredentialsError
        token = create_access_token(
            user_id=user.id, email=user.email, settings=settings
        )
        return TokenResponse(
            access_token=token,
            user={"id": user.id, "email": user.email},  # type: ignore[arg-type]
        )

    @staticmethod
    async def get_user_by_id(user_id: UUID, session: AsyncSession) -> AdminUser:
        """Load an admin user by id or raise `AdminUserNotFoundError`."""
        result = await session.exec(select(AdminUser).where(AdminUser.id == user_id))
        user = result.first()
        if user is None:
            raise AdminUserNotFoundError
        return user

    @staticmethod
    def decode_token(token: str, settings: Settings) -> UUID:
        """Decode a JWT and return its `sub` as a UUID. Raises on bad token."""
        try:
            payload = decode_access_token(token, settings)
        except jwt.PyJWTError as exc:
            raise InvalidTokenError from exc
        sub = payload.get("sub")
        if not isinstance(sub, str):
            raise InvalidTokenError
        try:
            return UUID(sub)
        except ValueError as exc:
            raise InvalidTokenError from exc
