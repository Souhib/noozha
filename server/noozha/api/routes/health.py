"""Liveness probe. Public, no auth, used by Docker HEALTHCHECK + uptime monitors."""

from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health() -> dict[str, bool]:
    """Return `{"ok": true}` when the process is alive."""
    return {"ok": True}
