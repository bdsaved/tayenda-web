from __future__ import annotations

import asyncio
import gzip
import json
import logging
import zlib
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from .config import settings
from .db import SessionLocal
from ..models.models import Trip


logger = logging.getLogger(__name__)


_PROCESSING_HEALTH: dict[str, Any] = {
    "status": "idle",
    "interval_seconds": settings.PROCESS_INTERVAL_SECONDS,
    "last_run_at": None,
    "next_run_at": None,
    "processed_trips_last_run": 0,
    "cleaned_files_last_run": 0,
}


async def run_processing_loop(stop_event: asyncio.Event) -> None:
    while not stop_event.is_set():
        processed = process_pending_gzip_trips()
        cleaned = cleanup_old_gzip_files()
        now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        _PROCESSING_HEALTH.update(
            {
                "status": "running",
                "interval_seconds": settings.PROCESS_INTERVAL_SECONDS,
                "last_run_at": now_ms,
                "next_run_at": now_ms + settings.PROCESS_INTERVAL_SECONDS * 1000,
                "processed_trips_last_run": processed,
                "cleaned_files_last_run": cleaned,
            }
        )
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=settings.PROCESS_INTERVAL_SECONDS)
        except asyncio.TimeoutError:
            continue


def get_processing_health() -> dict[str, Any]:
    return dict(_PROCESSING_HEALTH)


def process_pending_gzip_trips() -> int:
    db: Session = SessionLocal()
    processed_count = 0
    try:
        pending = (
            db.query(Trip)
            .filter(Trip.upload_source == "mobile", Trip.status.in_(["STORED", "UPLOADING"]))
            .all()
        )

        for trip in pending:
            trip_dir = settings.resolved_storage_path / trip.trip_id
            gzip_path = trip_dir / "trip.ndjson.gz"
            manifest_path = trip_dir / "manifest.json"
            figures_path = trip_dir / "figures.json"

            if not gzip_path.exists():
                continue

            trip.status = "PROCESSING"

            try:
                metrics = compute_gzip_metrics(gzip_path)
                manifest_payload = load_manifest(manifest_path)

                figures_payload = {
                    "trip_id": trip.trip_id,
                    "processed_at": int(datetime.now(timezone.utc).timestamp() * 1000),
                    "metrics": metrics,
                    "manifest": manifest_payload,
                }
                figures_path.write_text(
                    json.dumps(figures_payload, separators=(",", ":"), ensure_ascii=False),
                    encoding="utf-8",
                )

                trip.total_samples_received = metrics["samples_received"]
                trip.total_chunks_expected = 1
                trip.total_chunks_received = 1
                trip.total_samples = max(trip.total_samples, metrics["samples_received"])
                trip.avg_speed = metrics["avg_speed_mps"]
                trip.status = "UPLOADED"
                trip.finalized_at = datetime.now(timezone.utc)
                trip.artifact_path = str(figures_path)
                processed_count += 1
            except (gzip.BadGzipFile, OSError, EOFError, json.JSONDecodeError, UnicodeDecodeError, ValueError, zlib.error) as exc:
                trip.status = "FAILED"
                trip.notes = f"Processing failed: {exc.__class__.__name__}"
                logger.warning("Failed to process trip %s from %s: %s", trip.trip_id, gzip_path, exc)

        db.commit()
    finally:
        db.close()
    return processed_count


def cleanup_old_gzip_files() -> int:
    if settings.RAW_RETENTION_DAYS <= 0:
        return 0

    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.RAW_RETENTION_DAYS)
    cleaned = 0
    for trip_dir in settings.resolved_storage_path.iterdir() if settings.resolved_storage_path.exists() else []:
        if not trip_dir.is_dir():
            continue
        gzip_path = trip_dir / "trip.ndjson.gz"
        if not gzip_path.exists():
            continue
        modified = datetime.fromtimestamp(gzip_path.stat().st_mtime, tz=timezone.utc)
        if modified < cutoff:
            gzip_path.unlink(missing_ok=True)
            cleaned += 1
    return cleaned


def load_manifest(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def compute_gzip_metrics(path: Path) -> dict[str, float | int]:
    samples = 0
    speed_total = 0.0
    speed_count = 0
    speed_max = 0.0

    with gzip.open(path, mode="rt", encoding="utf-8") as fp:
        for line in fp:
            line = line.strip()
            if not line:
                continue
            samples += 1
            try:
                item = json.loads(line)
            except json.JSONDecodeError:
                continue
            speed = item.get("spd")
            if speed is None:
                speed = item.get("speed_mps")
            if isinstance(speed, (int, float)):
                speed_f = float(speed)
                speed_total += speed_f
                speed_count += 1
                speed_max = max(speed_max, speed_f)

    avg_speed = (speed_total / speed_count) if speed_count else 0.0

    return {
        "samples_received": samples,
        "avg_speed_mps": avg_speed,
        "max_speed_mps": speed_max,
    }
