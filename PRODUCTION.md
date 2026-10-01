# Production Deployment

This Compose setup serves the operator portal and API under one HTTPS domain
behind Nginx Proxy Manager.

## Routing

- `https://tayenda.renai-labs.com/` -> web client
- `https://tayenda.renai-labs.com/api/...` -> FastAPI
- `https://tayenda.renai-labs.com/docs` -> FastAPI docs
- `https://tayenda.renai-labs.com/health` -> FastAPI health

Nginx Proxy Manager terminates HTTPS and manages the Let's Encrypt certificate.
Caddy only listens on plain HTTP inside this app stack and routes requests to
the internal Docker services.

## Server Setup

Point DNS for the domain at the server running Nginx Proxy Manager.

Create `web/.env` (copy `web/.env.example`). The secrets are required; the
stack will not start without them, and the API refuses the old shipped
defaults in production:

```env
PUBLIC_DOMAIN=tayenda.renai-labs.com
NPM_UPSTREAM_PORT=3001
# python -c "import secrets; print(secrets.token_urlsafe(48))"
SECRET_KEY=<long random string>
OPERATOR_USERNAME=admin
OPERATOR_PASSWORD=<strong password>
OPERATOR_EMAIL=you@example.org
```

The default upstream port is `3001`, matching the existing Nginx Proxy Manager
proxy host shown for `tayenda.renai-labs.com`.

If the database already has the `admin` account with the old default
password, the API replaces it with `OPERATOR_PASSWORD` on the next start.
Changing `SECRET_KEY` signs everyone out once.

Schema changes are applied automatically at startup (Alembic). Databases created
by earlier versions, which never ran Alembic, are detected and upgraded in place.

Start the stack from `web/`:

```powershell
docker compose up -d --build
```

Check status:

```powershell
docker compose ps
docker compose logs -f proxy server client
```

## Nginx Proxy Manager

Edit the `tayenda.renai-labs.com` proxy host:

- Scheme: `http`
- Forward Hostname / IP: your Docker host IP, for example `89.167.68.60`
- Forward Port: `3001`
- SSL: keep the existing Let's Encrypt certificate
- Enable: Force SSL
- Enable: HTTP/2 Support

You do not need a separate `api.tayenda.renai-labs.com` host after this. Caddy
routes `https://tayenda.renai-labs.com/api/...` to FastAPI.

## Android Base URL

Build Android against the same domain:

```powershell
.\gradlew.bat :app:assembleRelease -PtayendaBaseUrl=https://tayenda.renai-labs.com/
```

The app calls paths like `/api/v1/devices/register`, so the final API URL is:

`https://tayenda.renai-labs.com/api/v1/devices/register`

## Data processing

Uploaded trips are analysed in the background (on upload, and every
`PROCESS_INTERVAL_SECONDS`): each trip is split into ~50 m road segments scored
by vertical-acceleration roughness, and jolts above `JOLT_THRESHOLD` are
recorded as likely potholes. After an algorithm update every stored trip is
re-processed automatically.

Raw phone files of processed trips are deleted after `RAW_RETENTION_DAYS`
(default 30). Segments and hazards stay in Postgres, so the map is unaffected,
but those trips can no longer be downloaded or reprocessed. Set
`RAW_RETENTION_DAYS=0` to keep raw files forever (budget disk accordingly:
roughly 2-10 MB per hour of driving).

## Smoke test

```powershell
cd server
$env:OPERATOR_PASSWORD="<password>"; python -m scripts.smoke_test --base-url https://tayenda.renai-labs.com          # health only
```

Add `--full` to exercise the upload pipeline; that leaves a small test trip
behind, which you can delete from the trip page.
