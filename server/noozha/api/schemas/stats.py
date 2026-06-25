"""Stats response schemas."""

from noozha.api.schemas.reservation import ReservationResponse
from noozha.api.schemas.shared import BaseModel, Money


class PeriodStats(BaseModel):
    revenue: Money
    count: int


class StatsResponse(BaseModel):
    revenue: Money
    count: int
    adults: int
    children: int


class SummaryResponse(BaseModel):
    week: PeriodStats
    month: PeriodStats
    year: PeriodStats
    upcoming: list[ReservationResponse]
