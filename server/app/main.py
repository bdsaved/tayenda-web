from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import v1
from .core.config import settings
from .core.db import engine
from .models.base import Base


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    Path(settings.resolved_storage_path).mkdir(parents=True, exist_ok=True)
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
