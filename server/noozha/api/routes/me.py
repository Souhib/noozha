"""Current admin user details."""

from fastapi import APIRouter

from noozha.api.dependencies import AdminDep
from noozha.api.schemas.auth import AdminUserResponse

router = APIRouter(prefix="/me", tags=["Me"])


@router.get("", response_model=AdminUserResponse)
async def me(current_admin: AdminDep) -> AdminUserResponse:
    """Return the admin user matching the bearer token."""
    return AdminUserResponse(id=current_admin.id, email=current_admin.email)
