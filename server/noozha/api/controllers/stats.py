"""Stats controller — period revenue + summary."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import and_, func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from noozha.api.models.table import Reservation, Status
from noozha.api.schemas.stats import PeriodStats, StatsResponse, SummaryResponse

_DECEMBER = 12
_ONE_MICROSECOND = timedelta(microseconds=1)


class StatsController:
    """Aggregations over reservations."""

    @staticmethod
    async def get_period(
        session: AsyncSession,
        *,
        from_iso: str | None = None,
        to_iso: str | None = None,
    ) -> StatsResponse:
        """CA + counts for confirmed reservations on the given window."""
        conditions = [Reservation.status == Status.CONFIRMED]
        if from_iso:
            conditions.append(
                Reservation.start_at
                >= datetime.fromisoformat(f"{from_iso}T00:00:00+00:00")
            )
        if to_iso:
            conditions.append(
                Reservation.start_at
                <= datetime.fromisoformat(f"{to_iso}T23:59:59+00:00")
            )

        stmt = select(
            func.coalesce(func.sum(Reservation.total_price), 0),
            func.count(),
            func.coalesce(func.sum(Reservation.adults), 0),
            func.coalesce(func.sum(Reservation.children), 0),
        ).where(and_(*conditions))
        result = await session.exec(stmt)
        revenue, count, adults, children = result.one()
        return StatsResponse(
            revenue=Decimal(str(revenue)),
            count=int(count),
            adults=int(adults),
            children=int(children),
        )

    @staticmethod
    async def get_summary(session: AsyncSession) -> SummaryResponse:
        """Week / month / year revenue + upcoming confirmed reservations."""
        now = datetime.now(UTC)

        # Compute the Mon-Sun window covering today (UTC).
        weekday = now.isoweekday()  # 1 = Monday
        start_week = now.replace(hour=0, minute=0, second=0, microsecond=0)
        start_week = start_week.replace(day=start_week.day - (weekday - 1))
        end_week = start_week.replace(
            day=start_week.day + 6, hour=23, minute=59, second=59
        )

        # Month
        start_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        next_month_first = (
            start_month.replace(year=start_month.year + 1, month=1)
            if start_month.month == _DECEMBER
            else start_month.replace(month=start_month.month + 1)
        )
        end_month = next_month_first.replace(day=1) - _ONE_MICROSECOND

        # Year
        start_year = now.replace(
            month=1, day=1, hour=0, minute=0, second=0, microsecond=0
        )
        end_year = start_year.replace(year=start_year.year + 1) - _ONE_MICROSECOND

        confirmed = Reservation.status == Status.CONFIRMED

        async def _agg(start: datetime, end: datetime) -> PeriodStats:
            stmt = select(
                func.coalesce(func.sum(Reservation.total_price), 0),
                func.count(),
            ).where(
                and_(
                    confirmed,
                    Reservation.start_at >= start,
                    Reservation.start_at <= end,
                )
            )
            result = await session.exec(stmt)
            revenue, count = result.one()
            return PeriodStats(revenue=Decimal(str(revenue)), count=int(count))

        week = await _agg(start_week, end_week)
        month = await _agg(start_month, end_month)
        year = await _agg(start_year, end_year)

        upcoming_stmt = (
            select(Reservation)
            .where(and_(confirmed, Reservation.start_at >= now))
            .order_by(Reservation.start_at)
            .limit(5)
        )
        upcoming_result = await session.exec(upcoming_stmt)
        upcoming = list(upcoming_result.all())

        return SummaryResponse(
            week=week,
            month=month,
            year=year,
            upcoming=upcoming,  # type: ignore[arg-type]
        )
