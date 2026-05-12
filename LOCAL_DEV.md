# Local Development on Windows

This setup keeps the app running on your machine and runs only Postgres in Docker.

## 1. Start Postgres in Docker

From `web/`, run:

```powershell
docker compose -f docker-compose.db.yml up -d
```

That exposes Postgres on `localhost:5432`.

## 2. Configure the Python server

Copy `server/.env.example` to `server/.env` and keep the database URL pointed at your local Docker container:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/tayenda
```

The server now reads `.env` from `web/server/`, so you can launch it from anywhere.

Run the API from `web/server/`:

```powershell
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## 3. Configure and run the web client

Copy `client/.env.example` to `client/.env` if you want to override the defaults. The client already defaults to `http://localhost:8000`, so this step is optional for local development.

Run the web app from `web/client/`:

```powershell
pnpm dev
```

## 4. Use ngrok from Windows

Point ngrok at the locally running web app or API, for example:

```powershell
ngrok http 3000
```

or

```powershell
ngrok http 8000
```

If you expose the API through ngrok, update `NGROK_ORIGIN` in `server/.env` and `VITE_NGROK_URL` in `client/.env` to match the public ngrok URL.