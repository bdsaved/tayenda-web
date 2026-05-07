from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    PROJECT_NAME: str = "Tayenda v1 API"
    VERSION: str = "1.0.0"
    DATABASE_URL: str = f"sqlite:///{(BASE_DIR / 'tayenda.db').as_posix()}"
    SECRET_KEY: str = "supersecretkey"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    STORAGE_PATH: str = str(BASE_DIR / "storage")
    WEB_CLIENT_ORIGIN: str = "http://localhost:3000"
    PUBLIC_WEB_ORIGIN: str = "https://tayenda.renai-labs.com"
    NGROK_ORIGIN: str = "https://strongbox-emphases-uptown.ngrok-free.dev"
    IRI_THRESHOLD_POOR: float = 4.0
    IRI_THRESHOLD_FAIR: float = 2.0

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def resolved_storage_path(self) -> Path:
        return Path(self.STORAGE_PATH).resolve()


settings = Settings()
