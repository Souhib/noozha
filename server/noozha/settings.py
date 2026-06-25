"""Application settings, loaded from environment variables (or a .env file).

Mirrors the LaTabdhir layered-env pattern: `NOOZHA_ENV` selects `.env.{env}` on top
of a base `.env`. In production all values are injected via the Dokploy env panel,
not a file on disk.
"""

import json
import os
from pathlib import Path

from dotenv import dotenv_values
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _get_env_file() -> tuple[str, ...]:
    """Pick the `.env` chain to load based on `NOOZHA_ENV`.

    Returns:
        A tuple of dotenv paths, evaluated left-to-right (later overrides earlier).
    """
    env = os.getenv("NOOZHA_ENV")
    if not env:
        selector_path = Path(".env")
        if selector_path.exists():
            selector = dotenv_values(selector_path)
            env = selector.get("NOOZHA_ENV", "development")
        else:
            env = "development"
    return (".env", f".env.{env}")


class Settings(BaseSettings):
    """Runtime configuration for the API."""

    model_config = SettingsConfigDict(
        env_file=_get_env_file(),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Environment ---
    noozha_env: str = "development"
    environment: str = "development"
    log_level: str = "INFO"
    enable_api_docs: bool = True

    # --- Database ---
    database_url: str

    # --- JWT ---
    jwt_secret_key: str
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # --- CORS ---
    cors_origins: str = "http://localhost:5173,http://localhost:8000"

    @field_validator("cors_origins")
    @classmethod
    def _parse_cors_origins(cls, v: str | list[str]) -> list[str]:
        """Accept either a JSON array or a comma-separated string."""
        if isinstance(v, list):
            return v
        if v.startswith("["):
            return json.loads(v)
        return [item.strip() for item in v.split(",") if item.strip()]
