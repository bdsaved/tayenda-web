import logging
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]

logger = logging.getLogger(__name__)

# Values that ship in the repo. The server refuses to start in production
# while any of these are still in use.
INSECURE_SECRET_KEYS = {"supersecretkey", "change-me", ""}
INSECURE_OPERATOR_PASSWORDS = {"tayenda-admin", "change-me", ""}


class Settings(BaseSettings):
    PROJECT_NAME: str = "Tayenda v1 API"
    VERSION: str = "1.1.0"
    # "development" allows the insecure defaults below; "production" refuses them.
    ENVIRONMENT: str = "development"
    DATABASE_URL: str = f"sqlite:///{(BASE_DIR / 'tayenda.db').as_posix()}"
    SECRET_KEY: str = "supersecretkey"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 720
    STORAGE_PATH: str = str(BASE_DIR / "storage")
    WEB_CLIENT_ORIGIN: str = "http://localhost:3000"
    PUBLIC_WEB_ORIGIN: str = "https://tayenda.renai-labs.com"
    NGROK_ORIGIN: str = ""
    OPERATOR_USERNAME: str = "admin"
    OPERATOR_PASSWORD: str = "tayenda-admin"
    OPERATOR_EMAIL: str = "admin@tayenda.local"
    PROCESS_INTERVAL_SECONDS: int = 120
    RAW_RETENTION_DAYS: int = 30
    MAX_UPLOAD_MB: int = 250

    # Road roughness model. Roughness is the RMS of vertical (earth-frame)
    # acceleration within a segment, in m/s^2. Thresholds were set from the
    # distribution of the first Malawi field trips (median ~0.45, p90 ~1.5) and
    # should be recalibrated once segments are validated on the ground.
    SEGMENT_LENGTH_M: float = 50.0
    MIN_SEGMENT_SPEED_MPS: float = 3.0
    ROUGHNESS_FAIR: float = 0.8
    ROUGHNESS_POOR: float = 1.6
    # A single vertical spike above this (m/s^2, ~1 g) is reported as a jolt.
    JOLT_THRESHOLD: float = 10.0
    # Hazard reports within this distance of each other are merged on the map.
    HAZARD_CLUSTER_RADIUS_M: float = 25.0

    model_config = SettingsConfigDict(env_file=str(BASE_DIR / ".env"), extra="ignore")

    @property
    def resolved_storage_path(self) -> Path:
        return Path(self.STORAGE_PATH).resolve()

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @property
    def cors_origins(self) -> list[str]:
        origins = {
            self.WEB_CLIENT_ORIGIN,
            self.PUBLIC_WEB_ORIGIN,
            self.NGROK_ORIGIN,
        }
        if not self.is_production:
            origins |= {"http://localhost:3000", "http://127.0.0.1:3000"}
        return sorted(origin for origin in origins if origin)

    def check_secrets(self) -> None:
        problems = []
        if self.SECRET_KEY in INSECURE_SECRET_KEYS or len(self.SECRET_KEY) < 16:
            problems.append("SECRET_KEY is a default or too short")
        if self.OPERATOR_PASSWORD in INSECURE_OPERATOR_PASSWORDS:
            problems.append("OPERATOR_PASSWORD is a default")
        if not problems:
            return
        message = "; ".join(problems)
        if self.is_production:
            raise RuntimeError(f"Refusing to start in production: {message}")
        logger.warning("Insecure development settings in use: %s", message)


settings = Settings()
