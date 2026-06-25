"""Stats endpoints — period aggregates + summary for the dashboard."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from noozha.api.controllers.stats import StatsController
from noozha.api.dependencies import AdminDep, SessionDep, get_current_admin
from noozha.api.schemas.stats import StatsResponse, SummaryResponse

router = APIRouter(
    prefix="/stats",
    tags=["Stats"],
    dependencies=[Depends(get_current_admin)],
)


@router.get("", response_model=StatsResponse)
async def period_stats(
    session: SessionDep,
    _admin: AdminDep,
    from_: Annotated[str | None, Query(alias="from")] = None,
    to: str | None = None,
) -> StatsResponse:
    """Aggregated revenue + counts for the given window (confirmed only)."""
    return await StatsController.get_period(session, from_iso=from_, to_iso=to)


@router.get("/summary", response_model=SummaryResponse)
async def summary(session: SessionDep, _admin: AdminDep) -> SummaryResponse:
    """Week / month / year revenue + 5 next upcoming reservations."""
    return await StatsController.get_summary(session)
