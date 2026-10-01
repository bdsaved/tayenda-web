from contextlib import asynccontextmanager
from pathlib import Path
import sys
import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

if __package__ in {None, ""}:
    sys.path.append(str(Path(__file__).resolve().parent.parent))

from app.api import v1
from app.core.config import settings
from app.core.db import SessionLocal, engine
from app.core.migrate import run_migrations
from app.core.processing import run_processing_loop
from app.core.security import ensure_default_operator


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.check_secrets()
    Path(settings.resolved_storage_path).mkdir(parents=True, exist_ok=True)

    # Bring the schema up to date and make sure a login-able operator exists so
    # the API is usable immediately on a fresh database.
    run_migrations(engine)
    db = SessionLocal()
    try:
        ensure_default_operator(db)
    finally:
        db.close()

    stop_event = asyncio.Event()
    processing_task = asyncio.create_task(run_processing_loop(stop_event))
    yield
    stop_event.set()
    processing_task.cancel()
    try:
        await processing_task
    except asyncio.CancelledError:
        pass

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1.router, prefix="/api")

@app.get("/")
def root():
    return {"message": "Welcome to Tayenda Malawi Road Quality API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}
