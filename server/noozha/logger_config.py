"""Loguru bootstrap. Replaces the default stderr handler with a project-wide
configuration that respects `LOG_LEVEL` and serializes structured fields.
"""

import sys

from loguru import logger

from noozha.settings import Settings


def setup_logging(settings: Settings) -> None:
    """Configure loguru with a single stderr sink at the configured level."""
    logger.remove()
    logger.add(
        sys.stderr,
        level=settings.log_level.upper(),
        format=(
            "<green>{time:YYYY-MM-DD HH:mm:ss}</green> "
            "<level>{level: <8}</level> "
            "<cyan>{name}</cyan>:<cyan>{line}</cyan> - "
            "<level>{message}</level>"
        ),
        backtrace=False,
        diagnose=False,
    )
