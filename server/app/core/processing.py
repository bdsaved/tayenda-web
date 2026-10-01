"""Background processing of uploaded trips into road segments and hazards."""
from __future__ import annotations

import asyncio
import gzip
import json
import logging
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from .config import settings
from .db import SessionLocal
from .roughness import PROCESSING_VERSION, TripAnalysis, read_and_analyse
from ..models.models import Hazard, RoadSegment, Trip, TripTrack

logger = logging.getLogger(__name__)

RAW_FILENAME = "trip.ndjson.gz"
LEGACY_BUNDLE_FILENAME = "trip-bundle.json"
# Statuses that mean the raw file has fully arrived.
RECEIVED_STATUSES = ("STORED", "PROCESSING", "UPLOADED", "FAILED")

# Processing runs from the background loop and from request handlers
# (upload, reprocess); one trip at a time keeps memory use predictable.
_processing_lock = threading.Lock()

_PROCESSING_HEALTH: dict[str, Any] = {
    "status": "idle",
    "interval_seconds": settings.PROCESS_INTERVAL_SECONDS,
    "last_run_at": None,
    "next_run_at": None,
    "processed_trips_last_run": 0,
    "cleaned_files_last_run": 0,
}


def now_ms() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def trip_dir(trip_id: str) -> Path:
    return settings.resolved_storage_path / trip_id


def raw_path(trip_id: str) -> Path:
    return trip_dir(trip_id) / RAW_FILENAME


def get_processing_health() -> dict[str, Any]:
    return dict(_PROCESSING_HEALTH)


async def run_processing_loop(stop_event: asyncio.Event) -> None:
    while not stop_event.is_set():
        try:
            processed = await asyncio.to_thread(process_pending_trips)
            cleaned = await asyncio.to_thread(cleanup_old_raw_files)
        except Exception:  # noqa: BLE001 - keep the loop alive and visible in health
            logger.exception("Processing loop iteration failed")
            processed, cleaned = 0, 0
            _PROCESSING_HEALTH["status"] = "error"
        else:
            _PROCESSING_HEALTH["status"] = "running"
        now = now_ms()
        _PROCESSING_HEALTH.update(
            {
                "interval_seconds": settings.PROCESS_INTERVAL_SECONDS,
                "last_run_at": now,
                "next_run_at": now + settings.PROCESS_INTERVAL_SECONDS * 1000,
                "processed_trips_last_run": processed,
                "cleaned_files_last_run": cleaned,
            }
        )
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=settings.PROCESS_INTERVAL_SECONDS)
        except asyncio.TimeoutError:
            continue


def process_pending_trips() -> int:
    db: Session = SessionLocal()
    try:
        trip_ids = [
            trip_id
            for (trip_id,) in db.query(Trip.trip_id)
            .filter(
                Trip.status.in_(RECEIVED_STATUSES),
                Trip.processing_version < PROCESSING_VERSION,
            )
            .order_by(Trip.start_time.asc())
            .all()
        ]
    finally:
        db.close()

    processed = 0
    for trip_id in trip_ids:
        if process_trip(trip_id):
            processed += 1
    return processed


def process_trip(trip_id: str) -> bool:
    """Analyse one trip and replace its stored segments and hazards.

    Returns True when the trip was analysed successfully.
    """
    with _processing_lock:
        db: Session = SessionLocal()
        try:
            trip = db.get(Trip, trip_id)
            if trip is None:
                return False

            path = raw_path(trip_id)
            if not path.exists():
                _convert_legacy_bundle(trip_id)
            if not path.exists():
                # Raw data was never received or is past retention. Record that
                # so the trip is not re-checked on every run.
                trip.processing_version = PROCESSING_VERSION
                if trip.status in ("STORED", "PROCESSING"):
                    trip.status = "FAILED"
                    trip.notes = "Raw trip file is missing on the server."
                db.commit()
                return False

            trip.status = "PROCESSING"
            db.commit()

            try:
                analysis = read_and_analyse(path)
            except OSError as exc:
                logger.warning("Could not read trip %s: %s", trip_id, exc)
                _mark_failed(db, trip, f"Could not read raw file: {exc.__class__.__name__}")
                return False

            if analysis.samples == 0:
                _mark_failed(db, trip, "No readable sensor samples in the uploaded file.")
                return False

            _store_analysis(db, trip, analysis, path)
            db.commit()
            return True
        except Exception:
            db.rollback()
            logger.exception("Processing trip %s failed", trip_id)
            try:
                trip = db.get(Trip, trip_id)
                if trip is not None:
                    _mark_failed(db, trip, "Processing error; see server logs.")
            except Exception:  # noqa: BLE001
                db.rollback()
            return False
        finally:
            db.close()


def _mark_failed(db: Session, trip: Trip, note: str) -> None:
    trip.status = "FAILED"
    trip.notes = note
    trip.processing_version = PROCESSING_VERSION
    db.commit()


def _store_analysis(db: Session, trip: Trip, analysis: TripAnalysis, path: Path) -> None:
    db.query(RoadSegment).filter(RoadSegment.trip_id == trip.trip_id).delete(synchronize_session=False)
    db.query(Hazard).filter(Hazard.trip_id == trip.trip_id).delete(synchronize_session=False)
    db.query(TripTrack).filter(TripTrack.trip_id == trip.trip_id).delete(synchronize_session=False)
    if analysis.track:
        db.add(
            TripTrack(
                trip_id=trip.trip_id,
                parts=[[list(point) for point in part] for part in analysis.track],
                point_count=sum(len(part) for part in analysis.track),
                distance_m=analysis.distance_m,
                start_ts=analysis.track[0][0][2],
                end_ts=analysis.track[-1][-1][2],
            )
        )

    db.add_all(
        RoadSegment(
            trip_id=trip.trip_id,
            seq=s.seq,
            start_ts=s.start_ts,
            length_m=s.length_m,
            distance_from_start_m=s.distance_from_start_m,
            avg_speed=s.avg_speed,
            sample_count=s.sample_count,
            roughness=s.roughness,
            condition=s.condition,
            coordinates=s.coordinates,
        )
        for s in analysis.segments
    )
    db.add_all(
        Hazard(
            trip_id=trip.trip_id,
            ts=h.ts,
            lat=h.lat,
            lon=h.lon,
            source=h.source,
            kind=h.kind,
            magnitude=h.magnitude,
            speed=h.speed,
        )
        for h in analysis.hazards
    )

    by_condition = analysis.length_by_condition()
    trip.total_samples_received = analysis.samples
    trip.total_samples = analysis.samples
    trip.total_chunks_expected = 1
    trip.total_chunks_received = 1
    if analysis.distance_m > 0:
        trip.total_distance = analysis.distance_m
    trip.avg_speed = round(analysis.avg_speed, 3)
    if trip.end_time is None and analysis.last_ts is not None:
        trip.end_time = analysis.last_ts
    trip.roughness_avg = round(analysis.roughness_avg, 4) if analysis.roughness_avg is not None else None
    trip.good_m = round(by_condition["GOOD"], 1)
    trip.fair_m = round(by_condition["FAIR"], 1)
    trip.poor_m = round(by_condition["POOR"], 1)
    trip.hazard_count = analysis.jolt_count
    trip.tag_count = analysis.tags
    trip.status = "UPLOADED"
    trip.processed_at = datetime.now(timezone.utc)
    trip.finalized_at = trip.finalized_at or trip.processed_at
    trip.processing_version = PROCESSING_VERSION
    trip.artifact_path = str(path)

    notes = []
    if analysis.damaged or analysis.bad_lines:
        notes.append(
            f"Recovered {analysis.samples:,} samples from a damaged file"
            + (f" ({analysis.bad_lines} unreadable lines skipped)." if analysis.bad_lines else ".")
        )
    if analysis.duplicates_dropped:
        notes.append(f"Dropped {analysis.duplicates_dropped:,} duplicate samples.")
    if not analysis.segments:
        notes.append("No road segments: the trip had no usable GPS track above walking speed.")
    # Web uploads carry the operator's own notes; keep those.
    if trip.upload_source != "web":
        trip.notes = " ".join(notes) or None


def _convert_legacy_bundle(trip_id: str) -> None:
    """Older web/chunk uploads were stored as a JSON bundle; rewrite as NDJSON gzip."""
    bundle_path = trip_dir(trip_id) / LEGACY_BUNDLE_FILENAME
    if not bundle_path.exists():
        return
    try:
        bundle = json.loads(bundle_path.read_text(encoding="utf-8"))
        chunks = sorted(bundle.get("chunks") or [], key=lambda c: c.get("chunk_seq", 0))
        write_samples_gzip(
            raw_path(trip_id),
            (sample for chunk in chunks for sample in (chunk.get("samples") or [])),
        )
    except (OSError, ValueError) as exc:
        logger.warning("Could not convert legacy bundle for %s: %s", trip_id, exc)


def write_samples_gzip(path: Path, samples) -> int:
    """Write sample dicts as NDJSON gzip atomically. Returns the line count."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    count = 0
    with gzip.open(tmp, "wt", encoding="utf-8") as fp:
        for sample in samples:
            fp.write(json.dumps(sample, separators=(",", ":"), ensure_ascii=False))
            fp.write("\n")
            count += 1
    tmp.replace(path)
    return count


def cleanup_old_raw_files() -> int:
    """Delete raw files of processed trips once they pass the retention window.

    Segments and hazards live in the database, so the map is unaffected.
    """
    if settings.RAW_RETENTION_DAYS <= 0:
        return 0

    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.RAW_RETENTION_DAYS)
    db: Session = SessionLocal()
    cleaned = 0
    try:
        processed_ids = {
            trip_id
            for (trip_id,) in db.query(Trip.trip_id).filter(
                Trip.status == "UPLOADED", Trip.processing_version >= PROCESSING_VERSION
            )
        }
    finally:
        db.close()

    for trip_id in processed_ids:
        path = raw_path(trip_id)
        if not path.exists():
            continue
        modified = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
        if modified < cutoff:
            path.unlink(missing_ok=True)
            cleaned += 1
    return cleaned
