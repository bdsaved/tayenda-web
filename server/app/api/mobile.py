"""Endpoints used by the Android field app (authenticated with x-api-key)."""
import hashlib
import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Header, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.db import get_db
from ..core.processing import process_trip, raw_path, trip_dir
from ..core.roughness import scan_file
from ..models.models import Device, Trip
from ..schemas.schemas import (
    DeviceRegister,
    DeviceResponse,
    TripManifest,
    TripResponse,
    UploadStatusResponse,
    WebTripUploadResponse,
)
from .deps import now_ms, require_device

router = APIRouter()

COPY_BLOCK = 1 << 20


@router.post("/devices/register", response_model=DeviceResponse)
def register_device(
    device_in: DeviceRegister,
    x_api_key: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> DeviceResponse:
    """Register a device, or confirm an existing registration.

    A known device only gets its current key back when it proves it already
    holds it. Otherwise (reinstall, lost key) a new key is issued and the old
    one stops working, so knowing a device id is not enough to take over its key.
    """
    device = db.get(Device, device_in.hashed_device_id)
    now = datetime.now(timezone.utc)

    if device is None:
        device = Device(
            hashed_device_id=device_in.hashed_device_id,
            model=device_in.model,
            os_version=device_in.os_version,
            app_version=device_in.app_version,
            user_uuid=str(uuid.uuid4()),
            api_key=secrets.token_urlsafe(32),
            last_seen_at=now,
        )
        db.add(device)
        status = "registered"
    else:
        device.model = device_in.model
        device.os_version = device_in.os_version
        device.app_version = device_in.app_version
        device.last_seen_at = now
        if x_api_key and device.api_key and secrets.compare_digest(x_api_key, device.api_key):
            status = "existing"
        else:
            device.api_key = secrets.token_urlsafe(32)
            status = "rotated"

    db.commit()
    return DeviceResponse(user_uuid=device.user_uuid, api_key=device.api_key, status=status)


@router.post("/trips/manifest", response_model=TripResponse)
def create_trip_manifest(
    manifest_in: TripManifest,
    device: Device = Depends(require_device),
    db: Session = Depends(get_db),
) -> TripResponse:
    if device.hashed_device_id != manifest_in.device_id:
        raise HTTPException(status_code=403, detail="Device ID does not match the authenticated device")

    trip = db.get(Trip, manifest_in.trip_id)
    if trip is not None and trip.device_id != device.hashed_device_id:
        raise HTTPException(status_code=403, detail="Trip belongs to another device")

    if trip is None:
        trip = Trip(trip_id=manifest_in.trip_id, status="PENDING", upload_source="mobile")
        db.add(trip)
    apply_manifest(trip, manifest_in, device.model)
    db.commit()
    return TripResponse(
        trip_id=trip.trip_id,
        server_trip_id=trip.server_trip_id,
        timestamp=now_ms(),
        status="accepted",
    )


def apply_manifest(trip: Trip, manifest_in: TripManifest, device_model: str | None) -> None:
    trip.version = manifest_in.version
    trip.device_id = manifest_in.device_id
    trip.device_model = device_model
    trip.mount_type = manifest_in.mount_type
    trip.vehicle_type = manifest_in.vehicle_type
    trip.road_surface = manifest_in.road_surface
    trip.sampling_profile = manifest_in.sampling_profile
    trip.start_time = manifest_in.start_time
    trip.end_time = manifest_in.end_time
    trip.mount_quality = manifest_in.mount_quality
    trip.quality_flags = manifest_in.quality_flags
    # Once the raw file is processed, the server's own figures win.
    if trip.processing_version == 0:
        trip.total_samples = manifest_in.total_samples
        trip.total_distance = manifest_in.total_distance
        trip.avg_speed = manifest_in.avg_speed


@router.get("/trips/{trip_id}/upload-status", response_model=UploadStatusResponse)
def get_trip_upload_status(
    trip_id: str,
    device: Device = Depends(require_device),
    db: Session = Depends(get_db),
) -> UploadStatusResponse:
    trip = db.get(Trip, trip_id)
    if trip is None or trip.device_id != device.hashed_device_id:
        raise HTTPException(status_code=404, detail="Trip not found")
    return UploadStatusResponse(
        trip_id=trip.trip_id,
        status=trip.status,
        chunks_received=trip.total_chunks_received,
        chunks_expected=trip.total_chunks_expected,
        samples_received=trip.total_samples_received,
        manifest_received=True,
        message=trip.notes if trip.status == "FAILED" else None,
    )


@router.post("/trips/{trip_id}/gzip", response_model=WebTripUploadResponse)
def upload_trip_gzip(
    trip_id: str,
    background: BackgroundTasks,
    file: UploadFile = File(...),
    total_samples: int = Form(default=0),
    sha256: str | None = Form(default=None),
    device: Device = Depends(require_device),
    db: Session = Depends(get_db),
) -> WebTripUploadResponse:
    trip = db.get(Trip, trip_id)
    if trip is None:
        raise HTTPException(status_code=404, detail="Trip not found; upload the manifest first")
    if trip.device_id != device.hashed_device_id:
        raise HTTPException(status_code=403, detail="Trip does not belong to the authenticated device")

    if not (file.filename or "trip.ndjson.gz").lower().endswith(".gz"):
        raise HTTPException(status_code=400, detail="Expected a .gz payload")

    storage = trip_dir(trip_id)
    storage.mkdir(parents=True, exist_ok=True)
    incoming = storage / f"upload-{uuid.uuid4().hex}.tmp"
    limit = settings.MAX_UPLOAD_MB * 1024 * 1024
    digest = hashlib.sha256()
    size = 0
    try:
        with incoming.open("wb") as out:
            while block := file.file.read(COPY_BLOCK):
                size += len(block)
                if size > limit:
                    raise HTTPException(status_code=413, detail=f"File exceeds {settings.MAX_UPLOAD_MB} MB")
                digest.update(block)
                out.write(block)
        if size == 0:
            raise HTTPException(status_code=400, detail="Uploaded gzip payload is empty")
        if sha256 and digest.hexdigest() != sha256.strip().lower():
            raise HTTPException(status_code=422, detail="Checksum mismatch; please retry the upload")

        scan = scan_file(incoming.read_bytes())
        if scan.samples == 0:
            raise HTTPException(status_code=422, detail="The file contains no readable sensor samples")
        incoming.replace(raw_path(trip_id))
    finally:
        incoming.unlink(missing_ok=True)

    trip.upload_source = "mobile"
    trip.total_chunks_expected = 1
    trip.total_chunks_received = 1
    # The server's own count is authoritative; the client's figure is advisory.
    trip.total_samples_received = scan.samples
    trip.total_samples = scan.samples
    trip.status = "STORED"
    trip.processing_version = 0
    trip.notes = None
    trip.artifact_path = str(raw_path(trip_id))
    db.commit()

    background.add_task(process_trip, trip_id)
    return WebTripUploadResponse(
        trip_id=trip.trip_id,
        status="stored",
        chunks_received=1,
        samples_received=scan.samples,
        artifact_path=None,
    )
