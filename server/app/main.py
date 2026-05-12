from contextlib import asynccontextmanager
from pathlib import Path
import sys
import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

if __package__ in {None, ""}:
    sys.path.append(str(Path(__file__).resolve().parent.parent))

from app.api import v1
from app.core.config import settings
from app.core.processing import run_processing_loop


@asynccontextmanager
async def lifespan(_: FastAPI):
    Path(settings.resolved_storage_path).mkdir(parents=True, exist_ok=True)
    stop_event = asyncio.Event()
    processing_task = asyncio.create_task(run_processing_loop(stop_event))
    yield
    stop_event.set()
    processing_task.cancel()
    try:
        await processing_task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.WEB_CLIENT_ORIGIN,
        settings.PUBLIC_WEB_ORIGIN,
        settings.NGROK_ORIGIN,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
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
