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

Create `web/.env` if you need to override defaults:

```env
PUBLIC_DOMAIN=tayenda.renai-labs.com
NPM_UPSTREAM_PORT=3001
```

The default upstream port is `3001`, matching the existing Nginx Proxy Manager
proxy host shown for `tayenda.renai-labs.com`.

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
