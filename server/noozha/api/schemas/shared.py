"""Shared Pydantic / SQLModel base classes — every model in the project
inherits from these instead of `pydantic.BaseModel` / `sqlmodel.SQLModel`.
"""

from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import ConfigDict, PlainSerializer
from sqlalchemy import TIMESTAMP
from sqlmodel import Field, SQLModel

# Exact Decimal in Python, JSON number on the wire so JS clients keep parsing
# prices as numbers (bare Decimal would serialize to a string).
DecimalNumber = Annotated[
    Decimal,
    PlainSerializer(
        lambda v: float(v) if v is not None else None,
        return_type=float,
        when_used="json",
    ),
]
Money = DecimalNumber


class BaseModel(SQLModel):
    """Base for every Pydantic / SQLModel schema in the project."""

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        arbitrary_types_allowed=True,
        extra="forbid",
    )


class BaseTable(BaseModel):
    """Base for every database table. Adds tz-aware `created_at` / `updated_at`."""

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_type=TIMESTAMP(timezone=True),  # type: ignore[invalid-argument-type]
        description="Timestamp when the record was created (UTC).",
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_type=TIMESTAMP(timezone=True),  # type: ignore[invalid-argument-type]
        sa_column_kwargs={"onupdate": lambda: datetime.now(UTC)},
        description="Timestamp when the record was last updated (UTC).",
    )
