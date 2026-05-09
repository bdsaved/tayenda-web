from contextlib import asynccontextmanager
from pathlib import Path
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

if __package__ in {None, ""}:
    sys.path.append(str(Path(__file__).resolve().parent.parent))

from app.api import v1
from app.core.config import settings
from app.core.db import SessionLocal, engine
from app.core.security import ensure_default_operator
from app.models.base import Base


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    Path(settings.resolved_storage_path).mkdir(parents=True, exist_ok=True)
    with SessionLocal() as db:
        ensure_default_operator(db)
    yield

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
