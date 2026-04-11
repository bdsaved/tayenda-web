from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "Tayenda v1 API"
    VERSION: str = "1.0.0"
    DATABASE_URL: str = "postgresql://user:password@localhost/tayenda"
    SECRET_KEY: str = "supersecretkey"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Storage
    STORAGE_PATH: str = "/app/storage"
    
    # Malawi Road ML Config
    IRI_THRESHOLD_POOR: float = 4.0
    IRI_THRESHOLD_FAIR: float = 2.0

    class Config:
        env_file = ".env"

settings = Settings()
