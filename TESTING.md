# Tayenda — Testing / Wiring Guide

This describes how the pieces connect and how to verify a deployment.

## Endpoints

| Component        | URL                                      |
|------------------|------------------------------------------|
| API (backend)    | `https://api.tayenda.renai-labs.com`     |
| Web dashboard    | `https://tayenda.renai-labs.com`         |
| Local API        | `http://localhost:8000`                  |
| Local dashboard  | `http://localhost:3000`                  |

The Android app and the web dashboard both talk to the **API** host above.
The bare domain is the dashboard, not the API.

## Default operator

The API creates a login-able operator on startup from
`OPERATOR_USERNAME` / `OPERATOR_PASSWORD` (default `admin` / `tayenda-admin`).
Change these before any real deployment.

## Smoke test

From `web/server/` (standard library only, no extra installs):

```bash
# Health only — safe against any environment, including production
python -m scripts.smoke_test --base-url https://api.tayenda.renai-labs.com

# Full write flow (device -> manifest -> chunk -> finalize -> operator list).
# Run against LOCAL/staging; it leaves a test trip behind.
python -m scripts.smoke_test --base-url http://localhost:8000 --full \
    --username admin --password tayenda-admin
```

## Run the API locally

```bash
cd web
docker compose -f docker-compose.db.yml up -d       # Postgres on :5432
cd server
cp .env.example .env                                 # DATABASE_URL points at local Postgres
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

On startup the API creates missing tables and seeds the operator, so a fresh
database is immediately usable. For a zero-dependency run you can instead point
at SQLite: `DATABASE_URL="sqlite:///./tayenda.db"`.

## Run the dashboard locally

```bash
cd web/client
cp .env.example .env         # set VITE_API_URL (live API by default)
pnpm install
pnpm dev                     # http://localhost:3000
```

`client/app/lib/api.ts` reads **`VITE_API_URL`** only. Set it to
`http://localhost:8000` for a fully local stack or leave it at the live API.

## Full local stack via Docker

```bash
cd web
docker compose up --build    # db + server(:8000) + client(:3001 -> container 3000)
```
