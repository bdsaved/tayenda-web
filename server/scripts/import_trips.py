"""Import trips from a folder of phone trip files and process them.

The Android app keeps each trip as ``<trip_id>.manifest.json`` plus
``<trip_id>.ndjson.gz`` in its private ``files/trips`` folder. Copy that folder
off the phone (see LOCAL_DEV.md), then run from ``web/server/``::

    python -m scripts.import_trips path/to/trips            # add missing raw data
    python -m scripts.import_trips path/to/trips --force    # replace existing raw data too
    python -m scripts.import_trips path/to/trips --dry-run

Trips the server already knows keep their record; only the raw file is added
and the trip is re-analysed. Unknown trips are created from the manifest.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import uuid
import secrets

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pathlib import Path  # noqa: E402

from app.api.mobile import apply_manifest  # noqa: E402
from app.core.db import SessionLocal, engine  # noqa: E402
from app.core.migrate import run_migrations  # noqa: E402
from app.core.processing import process_trip, raw_path  # noqa: E402
from app.core.roughness import scan_file  # noqa: E402
from app.models.models import Device, Trip  # noqa: E402
from app.schemas.schemas import TripManifest  # noqa: E402


def load_manifest(path: Path) -> tuple[TripManifest, str | None]:
    """Read either the upload format (snake_case) or the phone's own (camelCase)."""
    raw = json.loads(path.read_text(encoding="utf-8"))
    if "tripId" in raw:
        flags = raw.get("qualityFlags") or {}
        raw = {
            "trip_id": raw["tripId"],
            "version": raw.get("version") or "1.0",
            "device_id": raw["hashedDeviceId"],
            "mount_type": raw.get("mountType"),
            "vehicle_type": raw.get("vehicleType"),
            "road_surface": raw.get("roadSurface"),
            "sampling_profile": raw.get("samplingProfile"),
            "start_time": raw["startedAt"],
            "end_time": raw.get("endedAt"),
            "total_samples": raw.get("totalSamples") or 0,
            "total_distance": raw.get("totalDistance") or 0.0,
            "avg_speed": raw.get("avgSpeed") or 0.0,
            "mount_quality": raw.get("mountQualityRms") or 0.0,
            "quality_flags": {
                "low_gps": flags.get("lowGpsAccuracySamples", 0),
                "low_speed": flags.get("lowSpeedSamples", 0),
                "stationary": flags.get("stationarySamples", 0),
                "paused": flags.get("pausedSeconds", 0),
            },
            "_model": " ".join(filter(None, [raw.get("deviceManufacturer"), raw.get("deviceModel")])) or None,
        }
    model = raw.pop("_model", None)
    return TripManifest.model_validate(raw), model


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("folder", type=Path)
    parser.add_argument("--force", action="store_true", help="replace raw files the server already has")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    run_migrations(engine)
    manifests = sorted(args.folder.glob("*.manifest.json"))
    if not manifests:
        print(f"No *.manifest.json files in {args.folder}")
        return 1

    imported = skipped = failed = 0
    for manifest_path in manifests:
        trip_id = manifest_path.name.removesuffix(".manifest.json")
        data_path = manifest_path.with_name(f"{trip_id}.ndjson.gz")
        if not data_path.exists() or data_path.stat().st_size == 0:
            print(f"[skip] {trip_id}: no data file")
            skipped += 1
            continue
        if raw_path(trip_id).exists() and not args.force:
            print(f"[skip] {trip_id}: server already has raw data")
            skipped += 1
            continue

        try:
            manifest, device_model = load_manifest(manifest_path)
        except (KeyError, ValueError) as exc:
            print(f"[fail] {trip_id}: bad manifest ({str(exc).splitlines()[0]})")
            failed += 1
            continue
        scan = scan_file(data_path.read_bytes())
        if scan.samples == 0:
            print(f"[fail] {trip_id}: no readable samples")
            failed += 1
            continue
        if args.dry_run:
            print(f"[would import] {trip_id}: {scan.samples:,} samples" + (" (damaged)" if scan.damaged else ""))
            continue

        db = SessionLocal()
        try:
            device = db.get(Device, manifest.device_id)
            if device is None:
                device = Device(
                    hashed_device_id=manifest.device_id,
                    model=device_model or "Imported device",
                    os_version="unknown",
                    app_version=manifest.version,
                    user_uuid=str(uuid.uuid4()),
                    api_key=secrets.token_urlsafe(32),
                )
                db.add(device)
            trip = db.get(Trip, trip_id)
            if trip is None:
                trip = Trip(trip_id=trip_id, status="PENDING", upload_source="mobile")
                db.add(trip)
            elif trip.device_id != manifest.device_id:
                print(f"[fail] {trip_id}: belongs to another device on the server")
                failed += 1
                continue
            trip.processing_version = 0
            apply_manifest(trip, manifest, device.model)
            raw_path(trip_id).parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(data_path, raw_path(trip_id))
            trip.status = "STORED"
            trip.total_chunks_expected = trip.total_chunks_received = 1
            trip.total_samples_received = scan.samples
            db.commit()
        finally:
            db.close()

        ok = process_trip(trip_id)
        print(f"[{'ok' if ok else 'fail'}] {trip_id}: {scan.samples:,} samples")
        imported += ok
        failed += not ok

    print(f"\nImported {imported}, skipped {skipped}, failed {failed}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
