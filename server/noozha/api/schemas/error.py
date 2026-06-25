"""Custom error hierarchy. Routes raise these; `app.py` translates them to JSON."""

import re
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from fastapi import status


class LogLevel(StrEnum):
    """Severity for the error log line emitted by the global handler."""

    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class BaseError(Exception):
    """Base class for every domain error.

    Inheritors only set `status_code` + optional `frontend_message`.
    The `error_key` is auto-derived from the class name (e.g.,
    `ReservationNotFoundError` → `errors.api.reservationNotFound`).
    """

    @classmethod
    def _generate_error_key(cls) -> str:
        """Auto-derive the i18n key from the class name."""
        name = cls.__name__.removesuffix("Error")
        camel = re.sub(r"([A-Z])", r"_\1", name).strip("_")
        parts = camel.split("_")
        camel_case = parts[0].lower() + "".join(p.capitalize() for p in parts[1:])
        return f"errors.api.{camel_case}"

    def __init__(
        self,
        message: str,
        frontend_message: str | None = None,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        error_code: str | None = None,
        error_key: str | None = None,
        error_params: dict[str, str | int | float] | None = None,
        details: dict[str, Any] | None = None,
        log_level: LogLevel | None = None,
    ) -> None:
        self.message = message
        self.frontend_message = frontend_message or message
        self.status_code = status_code
        self.error_code = error_code or self.__class__.__name__
        self.error_key = error_key or self._generate_error_key()
        self.error_params = error_params
        self.details = details or {}
        self.log_level = log_level or self._default_log_level()
        self.timestamp = datetime.now(UTC)
        super().__init__(message)

    def _default_log_level(self) -> LogLevel:
        if self.status_code >= status.HTTP_500_INTERNAL_SERVER_ERROR:
            return LogLevel.ERROR
        return LogLevel.WARNING


# --- Concrete errors used across the API -----------------------------------
class InvalidCredentialsError(BaseError):
    def __init__(self) -> None:
        super().__init__(
            message="Email or password is incorrect.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )


class MissingTokenError(BaseError):
    def __init__(self) -> None:
        super().__init__(
            message="Authorization header is missing.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )


class InvalidTokenError(BaseError):
    def __init__(self) -> None:
        super().__init__(
            message="The provided token is invalid or expired.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )


class AdminUserNotFoundError(BaseError):
    def __init__(self) -> None:
        super().__init__(
            message="Admin user not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class ReservationNotFoundError(BaseError):
    def __init__(self) -> None:
        super().__init__(
            message="Reservation not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class InvalidGuestCountError(BaseError):
    def __init__(self) -> None:
        super().__init__(
            message="At least one guest (adult or child) is required.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )
