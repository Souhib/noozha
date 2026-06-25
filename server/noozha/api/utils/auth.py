"""JWT + password helpers. Kept tiny: single admin, no refresh tokens, no rotation."""

from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from passlib.context import CryptContext

from noozha.settings import Settings

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=10)

JWT_ALGORITHM = "HS256"


def hash_password(plain: str) -> str:
    """Return a bcrypt hash of the plaintext password."""
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if `plain` matches the bcrypt hash."""
    return _pwd_context.verify(plain, hashed)


def create_access_token(*, user_id: UUID, email: str, settings: Settings) -> str:
    """Build a signed JWT carrying the admin user id + email."""
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int(
            (now + timedelta(minutes=settings.access_token_expire_minutes)).timestamp()
        ),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str, settings: Settings) -> dict[str, str | int]:
    """Verify + decode a JWT. Raises `jwt.PyJWTError` on failure."""
    return jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[JWT_ALGORITHM],
        options={"require": ["exp", "sub", "email"]},
    )
