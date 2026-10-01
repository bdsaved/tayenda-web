import gzip
import json
import math
import os
import random
import sys
import tempfile
from pathlib import Path

import pytest

# Settings are read at import time, so point them at a throwaway database and
# storage directory before the app is imported.
_TMP = Path(tempfile.mkdtemp(prefix="tayenda-test-"))
os.environ["DATABASE_URL"] = f"sqlite:///{(_TMP / 'test.db').as_posix()}"
os.environ["STORAGE_PATH"] = str(_TMP / "storage")
os.environ["SECRET_KEY"] = "test-secret-key-0123456789"
os.environ["OPERATOR_USERNAME"] = "operator"
os.environ["OPERATOR_PASSWORD"] = "operator-test-password"
os.environ["PROCESS_INTERVAL_SECONDS"] = "3600"
os.environ["ENVIRONMENT"] = "development"

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

START_TS = 1_780_000_000_000
START_LAT, START_LON = -15.786, 35.005


def make_samples(
    seconds: int = 60,
    speed: float = 10.0,
    noise: float = 0.3,
    hz: int = 50,
    jolt_at_s: float | None = None,
    duplicate: bool = False,
    seed: int = 1,
) -> list[dict]:
    """A phone lying flat, driving due east at ``speed`` with vertical noise."""
    rng = random.Random(seed)
    metres_per_deg_lon = 111_320 * math.cos(math.radians(START_LAT))
    samples = []
    for i in range(seconds * hz):
        t = i / hz
        fix_t = math.floor(t)
        lon = START_LON + (speed * fix_t) / metres_per_deg_lon
        vertical = rng.gauss(0, noise)
        if jolt_at_s is not None and abs(t - jolt_at_s) < 0.5 / hz:
            vertical = 15.0
        sample = {
            "ts": START_TS + int(t * 1000),
            "lat": START_LAT,
            "lon": round(lon, 7),
            "spd": speed,
            "brg": 90.0,
            "gps_acc": 4.0,
            "fix_ts": START_TS + fix_t * 1000,
            "acc_d": [rng.gauss(0, 0.1), rng.gauss(0, 0.1), vertical],
            "rot": [0.0, 0.0, 0.0, 1.0, -1.0],
            "flags": 0,
        }
        samples.append(sample)
        if duplicate:
            samples.append(dict(sample))
    return samples


def to_gzip(records: list[dict]) -> bytes:
    body = "".join(json.dumps(r, separators=(",", ":")) + "\n" for r in records)
    return gzip.compress(body.encode("utf-8"))


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def operator_headers(client):
    response = client.post(
        "/api/v1/auth/login", json={"username": "operator", "password": "operator-test-password"}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture
def device(client):
    device_id = f"test-device-{random.randrange(10**9):09d}"
    response = client.post(
        "/api/v1/devices/register",
        json={"hashed_device_id": device_id, "model": "Pixel", "os_version": "Android 15", "app_version": "1.0"},
    )
    assert response.status_code == 200
    return {"id": device_id, "headers": {"x-api-key": response.json()["api_key"]}}


def manifest(trip_id: str, device_id: str) -> dict:
    return {
        "trip_id": trip_id,
        "version": "1.0",
        "device_id": device_id,
        "mount_type": "RIGID",
        "vehicle_type": "CAR",
        "road_surface": "GRAVEL",
        "sampling_profile": "BALANCED",
        "start_time": START_TS,
        "end_time": None,
        "total_samples": 0,
        "total_distance": 0.0,
        "avg_speed": 0.0,
        "mount_quality": 0.0,
        "quality_flags": None,
    }
