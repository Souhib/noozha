"""FastAPI application factory.

Wires the lifespan (engine + create_all), CORS, custom exception handlers, and
all routers (`/api/v1/...` for the data routes, root `/health` for the probe).
"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger

from noozha.api.routes.auth import router as auth_router
from noozha.api.routes.health import router as health_router
from noozha.api.routes.me import router as me_router
from noozha.api.routes.reservation import router as reservation_router
from noozha.api.routes.stats import router as stats_router
from noozha.api.schemas.error import BaseError
from noozha.database import create_db_and_tables, get_engine
from noozha.logger_config import setup_logging
from noozha.settings import Settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    settings = Settings()  # ty: ignore[missing-argument]
    setup_logging(settings)
    engine = await get_engine()
    await create_db_and_tables(engine)
    logger.info("noozha-api ready")
    yield
    await engine.dispose()
    logger.info("noozha-api shutdown complete")


def create_app() -> FastAPI:
    """Build the FastAPI app with CORS, error handlers, and all routers."""
    settings = Settings()  # ty: ignore[missing-argument]

    docs_kwargs: dict[str, str | None] = (
        {"docs_url": "/docs", "redoc_url": "/redoc", "openapi_url": "/openapi.json"}
        if settings.enable_api_docs
        else {"docs_url": None, "redoc_url": None, "openapi_url": None}
    )

    app = FastAPI(
        title="Noozha API",
        description="Backend for the Noozha admin panel (private-pool rental, Chelles 77500).",
        version="0.1.0",
        lifespan=lifespan,
        **docs_kwargs,  # type: ignore[arg-type]
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,  # type: ignore[arg-type]
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Public probe
    app.include_router(health_router)

    # Versioned API
    for router in (auth_router, me_router, reservation_router, stats_router):
        app.include_router(router, prefix="/api/v1")

    @app.exception_handler(BaseError)
    async def base_error_handler(
        request: Request,
        exc: BaseError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": exc.error_code,
                "error_key": exc.error_key,
                "message": exc.frontend_message,
                "error_params": exc.error_params,
                "details": exc.details,
                "timestamp": exc.timestamp.isoformat(),
            },
        )

    @app.exception_handler(Exception)
    async def fallback_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.bind(
            error=exc.__class__.__name__,
            path=request.url.path,
            method=request.method,
        ).exception("Unhandled server error")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "InternalServerError",
                "error_key": "errors.api.internalServer",
                "message": "Something went wrong on our end. Please try again later.",
                "error_params": None,
                "details": {},
                "timestamp": datetime.now(UTC).isoformat(),
            },
        )

    return app


app = create_app()
