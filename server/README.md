# noozha-api

FastAPI backend for the Noozha admin panel. Replaces the previous NocoDB integration.

## Stack
- **Runtime**: Python 3.12 + uvicorn
- **Framework**: FastAPI + SQLModel
- **DB**: PostgreSQL 16 (asyncpg)
- **Auth**: bcrypt + JWT (PyJWT)
- **Deps**: `uv` (frozen lockfile)
- **Tooling**: ruff (lint/format) + ty (type-check) + pytest + poethepoet

## Local dev

```bash
cd server
cp .env.example .env
# Adjust DATABASE_URL, JWT_SECRET_KEY, SEED_ADMIN_*
uv sync
uv run poe seed        # creates the admin user (idempotent)
uv run poe dev          # http://localhost:8000/docs
```

## Layout

```
noozha/
  api/
    routes/        ← FastAPI routers — NO LOGIC ALLOWED (just call controllers)
    controllers/   ← business logic + every DB call
    models/        ← SQLModel tables
    schemas/       ← Pydantic request/response models
    utils/         ← pricing, JWT helpers, etc.
    constants.py   ← tariff grid + tier brackets + magic numbers
    dependencies.py ← shared FastAPI deps (settings, current admin)
  app.py           ← create_app() + exception handlers + lifespan
  database.py      ← engine singleton + get_session
  settings.py      ← pydantic-settings, reads .env
scripts/
  seed.py          ← idempotent admin-user seed
main.py            ← uvicorn entry point
```

## Endpoints (all prefixed `/api/v1` unless noted)

| Method | Path                       | Auth | Purpose                                  |
|--------|----------------------------|------|------------------------------------------|
| GET    | `/health` (root)           | —    | Docker HEALTHCHECK liveness probe        |
| POST   | `/auth/login`              | —    | Email + password → access token          |
| GET    | `/me`                      | JWT  | Current admin user                       |
| GET    | `/reservations?from&to&status` | JWT | List with optional filters          |
| GET    | `/reservations/:id`        | JWT  | Fetch one                                |
| POST   | `/reservations`            | JWT  | Create (server computes the total)       |
| POST   | `/reservations/estimate`   | JWT  | Live price preview without persisting    |
| PATCH  | `/reservations/:id`        | JWT  | Update (server recomputes the total)     |
| DELETE | `/reservations/:id`        | JWT  | Remove                                   |
| GET    | `/stats?from&to`           | JWT  | Aggregated revenue + counts for a window |
| GET    | `/stats/summary`           | JWT  | Week + month + year + 5 upcoming         |

## Pricing rules
- **Tariff grid**: `noozha/api/constants.py` — €/personne for a 4h slot, by (slot, tier).
- **Tier**: `≤6 = small`, `7-10 = medium`, `11-15 = large` — based on **total** guests.
- **Child** = under 12 = 50% of the adult price.
- **Total** = `adults × adult_unit + children × child_unit + food_persons × food_unit − discount`.
- Snapshotted on the row (`base_price_pool`, `food_price_total`, `discount_amount`, `total_price`) so future grid changes don't rewrite history.

## Quality gates
```bash
uv run poe check       # lint + format-check + type-check
uv run poe fix         # auto-fix everything locally
uv run poe test        # pytest + coverage
```
