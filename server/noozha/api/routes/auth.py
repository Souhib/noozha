"""Login endpoint. Body is delegated to the controller."""

from fastapi import APIRouter

from noozha.api.controllers.auth import AuthController
from noozha.api.dependencies import SessionDep, SettingsDep
from noozha.api.schemas.auth import LoginRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    session: SessionDep,
    settings: SettingsDep,
) -> TokenResponse:
    """Verify credentials and return a fresh JWT."""
    return await AuthController.login(payload, session, settings)
