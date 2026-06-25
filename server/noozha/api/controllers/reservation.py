"""Reservation controller — every DB call + pricing decision lives here."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import and_
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from noozha.api.models.table import Reservation
from noozha.api.schemas.error import (
    InvalidGuestCountError,
    ReservationNotFoundError,
)
from noozha.api.schemas.reservation import (
    EstimateRequest,
    PriceBreakdown,
    ReservationCreate,
    ReservationUpdate,
)
from noozha.api.utils.pricing import compute_total_price, default_slot_hours


class ReservationController:
    """All reservation read/write logic."""

    @staticmethod
    def _ensure_guests(adults: int, children: int) -> None:
        if adults + children < 1:
            raise InvalidGuestCountError

    @staticmethod
    def _resolve_hours(
        slot: str,
        iso_date: str,
        start_at: datetime | None,
        end_at: datetime | None,
    ) -> tuple[datetime, datetime]:
        """Fill in default slot hours when the admin doesn't override them."""
        default_start, default_end = default_slot_hours(slot, iso_date)  # type: ignore[arg-type]
        return start_at or default_start, end_at or default_end

    # --- read paths ---------------------------------------------------------
    @staticmethod
    async def list_(
        session: AsyncSession,
        *,
        from_iso: str | None = None,
        to_iso: str | None = None,
        status: str | None = None,
    ) -> list[Reservation]:
        """List reservations, optionally filtered by start_at range + status."""
        conditions = []
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
        if status:
            conditions.append(Reservation.status == status)
        stmt = select(Reservation)
        if conditions:
            stmt = stmt.where(and_(*conditions))
        stmt = stmt.order_by(Reservation.start_at)
        result = await session.exec(stmt)
        return list(result.all())

    @staticmethod
    async def get(session: AsyncSession, reservation_id: UUID) -> Reservation:
        result = await session.exec(
            select(Reservation).where(Reservation.id == reservation_id)
        )
        reservation = result.first()
        if reservation is None:
            raise ReservationNotFoundError
        return reservation

    # --- write paths --------------------------------------------------------
    @classmethod
    async def create(
        cls, session: AsyncSession, payload: ReservationCreate
    ) -> Reservation:
        cls._ensure_guests(payload.adults, payload.children)
        start_at, end_at = cls._resolve_hours(
            payload.slot, payload.date, payload.start_at, payload.end_at
        )
        breakdown = compute_total_price(
            slot=payload.slot,
            adults=payload.adults,
            children=payload.children,
            food_formula=payload.food_formula,
            food_persons=payload.food_persons,
            discount=payload.discount_amount,
        )
        reservation = Reservation(
            slot=payload.slot,  # type: ignore[arg-type]
            start_at=start_at,  # type: ignore[arg-type]
            end_at=end_at,  # type: ignore[arg-type]
            customer_name=payload.customer_name.strip(),
            customer_phone=payload.customer_phone.strip(),
            adults=payload.adults,
            children=payload.children,
            base_price_pool=breakdown["pool"],  # type: ignore[arg-type]
            food_formula=payload.food_formula,  # type: ignore[arg-type]
            food_persons=payload.food_persons,
            food_price_total=breakdown["food"],  # type: ignore[arg-type]
            discount_amount=breakdown["discount"],  # type: ignore[arg-type]
            discount_reason=payload.discount_reason,
            total_price=breakdown["total"],  # type: ignore[arg-type]
            deposit_paid=payload.deposit_paid,
            deposit_method=payload.deposit_method,  # type: ignore[arg-type]
            status=payload.status,  # type: ignore[arg-type]
            notes=payload.notes,
        )
        session.add(reservation)
        await session.commit()
        await session.refresh(reservation)
        return reservation

    @classmethod
    async def update(
        cls,
        session: AsyncSession,
        reservation_id: UUID,
        payload: ReservationUpdate,
    ) -> Reservation:
        reservation = await cls.get(session, reservation_id)

        # Apply field-level overrides, defaulting to the existing value.
        slot = payload.slot or reservation.slot.value  # type: ignore[union-attr]
        iso_date = payload.date or reservation.start_at.date().isoformat()
        adults = payload.adults if payload.adults is not None else reservation.adults
        children = (
            payload.children if payload.children is not None else reservation.children
        )
        cls._ensure_guests(adults, children)

        food_formula = (
            None
            if payload.clear_food
            else (
                payload.food_formula
                if payload.food_formula is not None
                else (
                    reservation.food_formula.value if reservation.food_formula else None
                )
            )
        )
        food_persons = (
            None
            if payload.clear_food
            else (
                payload.food_persons
                if payload.food_persons is not None
                else reservation.food_persons
            )
        )
        discount = (
            payload.discount_amount
            if payload.discount_amount is not None
            else reservation.discount_amount
        )

        start_at, end_at = cls._resolve_hours(
            slot, iso_date, payload.start_at, payload.end_at
        )
        breakdown = compute_total_price(
            slot=slot,  # type: ignore[arg-type]
            adults=adults,
            children=children,
            food_formula=food_formula,  # type: ignore[arg-type]
            food_persons=food_persons,
            discount=Decimal(str(discount)),
        )

        reservation.slot = slot  # type: ignore[assignment]
        reservation.start_at = start_at  # type: ignore[assignment]
        reservation.end_at = end_at  # type: ignore[assignment]
        if payload.customer_name is not None:
            reservation.customer_name = payload.customer_name.strip()
        if payload.customer_phone is not None:
            reservation.customer_phone = payload.customer_phone.strip()
        reservation.adults = adults
        reservation.children = children
        reservation.food_formula = food_formula  # type: ignore[assignment]
        reservation.food_persons = food_persons
        reservation.base_price_pool = breakdown["pool"]  # type: ignore[assignment]
        reservation.food_price_total = breakdown["food"]  # type: ignore[assignment]
        reservation.discount_amount = breakdown["discount"]  # type: ignore[assignment]
        if payload.discount_reason is not None:
            reservation.discount_reason = payload.discount_reason
        reservation.total_price = breakdown["total"]  # type: ignore[assignment]
        if payload.deposit_paid is not None:
            reservation.deposit_paid = payload.deposit_paid
        if payload.deposit_method is not None:
            reservation.deposit_method = payload.deposit_method  # type: ignore[assignment]
        if payload.status is not None:
            reservation.status = payload.status  # type: ignore[assignment]
        if payload.notes is not None:
            reservation.notes = payload.notes

        session.add(reservation)
        await session.commit()
        await session.refresh(reservation)
        return reservation

    @classmethod
    async def delete(cls, session: AsyncSession, reservation_id: UUID) -> None:
        reservation = await cls.get(session, reservation_id)
        await session.delete(reservation)
        await session.commit()

    # --- pricing preview ----------------------------------------------------
    @staticmethod
    def estimate(payload: EstimateRequest) -> PriceBreakdown:
        breakdown = compute_total_price(
            slot=payload.slot,
            adults=payload.adults,
            children=payload.children,
            food_formula=payload.food_formula,
            food_persons=payload.food_persons,
            discount=payload.discount_amount,
        )
        return PriceBreakdown(
            tier=breakdown["tier"],  # type: ignore[arg-type]
            adult_unit_price=breakdown["adult_unit"],  # type: ignore[arg-type]
            child_unit_price=breakdown["child_unit"],  # type: ignore[arg-type]
            pool_total=breakdown["pool"],  # type: ignore[arg-type]
            food_total=breakdown["food"],  # type: ignore[arg-type]
            discount=breakdown["discount"],  # type: ignore[arg-type]
            grand_total=breakdown["total"],  # type: ignore[arg-type]
        )
