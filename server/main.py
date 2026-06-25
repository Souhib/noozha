"""Uvicorn entry point for the Noozha API."""

import uvicorn

from noozha.app import app

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)  # noqa: S104 — container binds all interfaces intentionally
