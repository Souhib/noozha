"""Idempotent admin-user seed.

Reads `SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD` from the env. Skips when the
user already exists. Safe to run on every container boot.
"""

import asyncio
import os
import sys

from loguru import logger
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from noozha.api.models.table import AdminUser
from noozha.api.utils.auth import hash_password
from noozha.database import create_db_and_tables, get_engine


async def _seed() -> int:
    email = os.environ.get("SEED_ADMIN_EMAIL", "").strip().lower()
    password = os.environ.get("SEED_ADMIN_PASSWORD", "")
    if not email or not password:
        logger.error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must both be set")
        return 1

    engine = await get_engine()
    await create_db_and_tables(engine)
    async with AsyncSession(engine, expire_on_commit=False) as session:
        existing = await session.exec(select(AdminUser).where(AdminUser.email == email))
        if existing.first() is not None:
            logger.info("Admin {} already exists — skipping", email)
            return 0
        user = AdminUser(email=email, password_hash=hash_password(password))
        session.add(user)
        await session.commit()
        logger.info("Seeded admin {} (id={})", email, user.id)
    await engine.dispose()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(_seed()))
