"""Auth-related request / response schemas."""

from uuid import UUID

from pydantic import EmailStr

from noozha.api.schemas.shared import BaseModel


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AdminUserResponse(BaseModel):
    id: UUID
    email: EmailStr


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"  # noqa: S105 — OAuth2 token type literal, not a secret
    user: AdminUserResponse
