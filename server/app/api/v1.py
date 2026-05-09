import gzip
import hashlib
import json
import secrets
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.db import get_db
from ..core.security import authenticate_user, create_access_token, decode_token
from ..models.models import Chunk, Device, Trip, User
from ..schemas.schemas import (
    ChunkResponse,
    DeviceRegister,
    DeviceResponse,
    FinalizeResponse,
    LoginRequest,
    TokenResponse,
    TripChunk,
    TripDetailResponse,
    TripFinalize,
    TripListItem,
    TripListResponse,
    TripManifest,
    TripResponse,
    UploadStatusResponse,
    UserResponse,
    WebTripUploadResponse,
)

router = APIRouter(prefix="/v1")
CHUNK_SIZE = 500


def now_ms() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def to_millis(value: datetime | None) -> int | None:
    if value is None:
        return None
    return int(value.replace(tzinfo=timezone.utc).timestamp() * 1000)


def trip_storage_dir(trip_id: str) -> Path:
    path = settings.resolved_storage_path / trip_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")


def chunk_checksum(samples: list[dict[str, Any]]) -> str:
    payload = json.dumps(samples, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def trip_to_summary(trip: Trip) -> TripListItem:
    return TripListItem(
        trip_id=trip.trip_id,
        server_trip_id=trip.server_trip_id,
        device_id=trip.device_id,
        device_model=trip.device_model,
        operator_name=trip.operator_name,
        status=trip.status,
        upload_source=trip.upload_source,
        start_time=trip.start_time,
        end_time=trip.end_time,
        total_samples=trip.total_samples,
        total_samples_received=trip.total_samples_received,
        total_chunks_expected=trip.total_chunks_expected,
        total_chunks_received=trip.total_chunks_received,
        road_surface=trip.road_surface,
        vehicle_type=trip.vehicle_type,
        mount_type=trip.mount_type,
        sampling_profile=trip.sampling_profile,
        mount_quality=trip.mount_quality,
        avg_speed=trip.avg_speed,
        total_distance=trip.total_distance,
        created_at=to_millis(trip.created_at) or now_ms(),
        finalized_at=to_millis(trip.finalized_at),
    )


def require_device(db: Session, x_api_key: str | None) -> Device:
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing x-api-key")
    device = db.query(Device).filter(Device.api_key == x_api_key).first()
    if device is None:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return device


def require_operator(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    username = decode_token(token)
    if username is None:
        raise HTTPException(status_code=401, detail="Invalid bearer token")
    user = db.query(User).filter(User.username == username, User.is_active.is_(True)).first()
    if user is None:
        raise HTTPException(status_code=401, detail="Operator account not found")
    return user


def recompute_trip_progress(trip: Trip, db: Session) -> tuple[int, int]:
    chunks = db.query(Chunk).filter(Chunk.trip_id == trip.trip_id).order_by(Chunk.chunk_seq.asc()).all()
    trip.total_chunks_received = len(chunks)
    trip.total_samples_received = sum(chunk.sample_count for chunk in chunks)
    return trip.total_chunks_received, trip.total_samples_received


def persist_trip_artifact(trip: Trip, chunks: list[Chunk]) -> str:
    storage_dir = trip_storage_dir(trip.trip_id)
    manifest_payload = {
        "trip_id": trip.trip_id,
        "server_trip_id": trip.server_trip_id,
        "device_id": trip.device_id,
        "device_model": trip.device_model,
        "operator_name": trip.operator_name,
        "version": trip.version,
        "mount_type": trip.mount_type,
        "vehicle_type": trip.vehicle_type,
        "road_surface": trip.road_surface,
        "sampling_profile": trip.sampling_profile,
        "start_time": trip.start_time,
        "end_time": trip.end_time,
        "total_samples": trip.total_samples,
        "total_distance": trip.total_distance,
        "avg_speed": trip.avg_speed,
        "mount_quality": trip.mount_quality,
        "quality_flags": trip.quality_flags,
        "status": trip.status,
        "upload_source": trip.upload_source,
        "notes": trip.notes,
    }
    write_json(storage_dir / "manifest.json", manifest_payload)
    bundle_path = storage_dir / "trip-bundle.json"
    write_json(
        bundle_path,
        {
            "manifest": manifest_payload,
            "chunks": [
                {
                    "chunk_seq": chunk.chunk_seq,
                    "sample_count": chunk.sample_count,
                    "checksum": chunk.checksum,
                    "samples": chunk.samples,
                }
                for chunk in chunks
            ],
        },
    )
    return str(bundle_path)


def upsert_manifest_trip(manifest_in: TripManifest, device: Device, db: Session) -> Trip:
    trip = db.query(Trip).filter(Trip.trip_id == manifest_in.trip_id).first()
    if trip is None:
        trip = Trip(
            trip_id=manifest_in.trip_id,
            version=manifest_in.version,
            device_id=manifest_in.device_id,
            device_model=device.model,
            mount_type=manifest_in.mount_type,
            vehicle_type=manifest_in.vehicle_type,
            road_surface=manifest_in.road_surface,
            sampling_profile=manifest_in.sampling_profile,
            start_time=manifest_in.start_time,
            end_time=manifest_in.end_time,
            total_samples=manifest_in.total_samples,
            total_distance=manifest_in.total_distance,
            avg_speed=manifest_in.avg_speed,
            mount_quality=manifest_in.mount_quality,
            quality_flags=manifest_in.quality_flags,
            status="PENDING",
            upload_source="mobile",
        )
        db.add(trip)
    else:
        trip.version = manifest_in.version
        trip.device_id = manifest_in.device_id
        trip.device_model = device.model
        trip.mount_type = manifest_in.mount_type
        trip.vehicle_type = manifest_in.vehicle_type
        trip.road_surface = manifest_in.road_surface
        trip.sampling_profile = manifest_in.sampling_profile
        trip.start_time = manifest_in.start_time
        trip.end_time = manifest_in.end_time
        trip.total_samples = manifest_in.total_samples
        trip.total_distance = manifest_in.total_distance
        trip.avg_speed = manifest_in.avg_speed
        trip.mount_quality = manifest_in.mount_quality
        trip.quality_flags = manifest_in.quality_flags
        if trip.status == "FAILED":
            trip.status = "PENDING"

    write_json(
        trip_storage_dir(manifest_in.trip_id) / "manifest.json",
        {
            "trip_id": manifest_in.trip_id,
            "version": manifest_in.version,
            "device_id": manifest_in.device_id,
            "mount_type": manifest_in.mount_type,
            "vehicle_type": manifest_in.vehicle_type,
            "road_surface": manifest_in.road_surface,
            "sampling_profile": manifest_in.sampling_profile,
            "start_time": manifest_in.start_time,
            "end_time": manifest_in.end_time,
            "total_samples": manifest_in.total_samples,
            "total_distance": manifest_in.total_distance,
            "avg_speed": manifest_in.avg_speed,
            "mount_quality": manifest_in.mount_quality,
            "quality_flags": manifest_in.quality_flags,
        },
    )
    db.commit()
    db.refresh(trip)
    return trip


def parse_samples_file(filename: str | None, content: bytes) -> list[dict[str, Any]]:
    file_name = (filename or "").lower()
    payload = gzip.decompress(content) if file_name.endswith(".gz") else content
    text = payload.decode("utf-8").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Uploaded sample file is empty")

    is_json_document = (
        file_name.endswith(".json")
        or file_name.endswith(".json.gz")
        or text.startswith("[")
        or (text.startswith("{") and len(text.splitlines()) == 1)
    )

    if is_json_document:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            parsed = parsed.get("samples")
        if not isinstance(parsed, list):
            raise HTTPException(status_code=400, detail="JSON sample upload must contain a samples array")
        return parsed

    samples: list[dict[str, Any]] = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        parsed_line = json.loads(line)
        if not isinstance(parsed_line, dict):
            raise HTTPException(status_code=400, detail="NDJSON samples must contain one object per line")
        samples.append(parsed_line)
    return samples


@router.get("/health")
def api_health() -> dict[str, str]:
    return {"status": "healthy"}


@router.post("/auth/login", response_model=TokenResponse)
def login(login_in: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = authenticate_user(db, login_in.username, login_in.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return TokenResponse(access_token=create_access_token(user.username), user=UserResponse.model_validate(user))


@router.get("/auth/me", response_model=UserResponse)
def current_user(user: User = Depends(require_operator)) -> UserResponse:
    return UserResponse.model_validate(user)


@router.post("/devices/register", response_model=DeviceResponse)
def register_device(device_in: DeviceRegister, db: Session = Depends(get_db)) -> DeviceResponse:
    device = db.query(Device).filter(Device.hashed_device_id == device_in.hashed_device_id).first()
    status = "existing" if device else "registered"

    if device is None:
        device = Device(
            hashed_device_id=device_in.hashed_device_id,
            model=device_in.model,
            os_version=device_in.os_version,
            app_version=device_in.app_version,
            user_uuid=str(uuid.uuid4()),
            api_key=secrets.token_urlsafe(32),
        )
        db.add(device)
    else:
        device.model = device_in.model
        device.os_version = device_in.os_version
        device.app_version = device_in.app_version
        if not device.api_key:
            device.api_key = secrets.token_urlsafe(32)

    db.commit()
    db.refresh(device)
    return DeviceResponse(user_uuid=device.user_uuid, api_key=device.api_key, status=status)


@router.post("/trips/manifest", response_model=TripResponse)
def create_trip_manifest(
    manifest_in: TripManifest,
    db: Session = Depends(get_db),
    x_api_key: str | None = Header(default=None),
) -> TripResponse:
    device = require_device(db, x_api_key)
    if device.hashed_device_id != manifest_in.device_id:
        raise HTTPException(status_code=403, detail="Device ID does not match the authenticated device")

    trip = upsert_manifest_trip(manifest_in, device, db)
    return TripResponse(
        trip_id=trip.trip_id,
        server_trip_id=trip.server_trip_id,
        timestamp=now_ms(),
        status="accepted",
    )


@router.post("/trips/{trip_id}/chunks", response_model=ChunkResponse)
def upload_chunk(
    trip_id: str,
    chunk_in: TripChunk,
    db: Session = Depends(get_db),
    x_api_key: str | None = Header(default=None),
) -> ChunkResponse:
    device = require_device(db, x_api_key)
    if chunk_in.trip_id != trip_id:
        raise HTTPException(status_code=400, detail="Trip ID in path does not match request body")

    trip = db.query(Trip).filter(Trip.trip_id == trip_id).first()
    if trip is None:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.device_id != device.hashed_device_id:
        raise HTTPException(status_code=403, detail="Trip does not belong to the authenticated device")

    checksum_match = chunk_checksum(chunk_in.samples) == chunk_in.checksum
    if not checksum_match:
        return ChunkResponse(
            trip_id=trip_id,
            chunk_seq=chunk_in.chunk_seq,
            status="rejected",
            checksum_match=False,
            timestamp=now_ms(),
            message="Checksum mismatch",
        )

    existing_chunk = (
        db.query(Chunk)
        .filter(Chunk.trip_id == trip_id, Chunk.chunk_seq == chunk_in.chunk_seq)
        .first()
    )
    if existing_chunk:
        if existing_chunk.checksum != chunk_in.checksum:
            return ChunkResponse(
                trip_id=trip_id,
                chunk_seq=chunk_in.chunk_seq,
                status="rejected",
                checksum_match=False,
                timestamp=now_ms(),
                message="Existing chunk payload does not match retry payload",
            )
        return ChunkResponse(
            trip_id=trip_id,
            chunk_seq=chunk_in.chunk_seq,
            status="duplicate",
            checksum_match=True,
            timestamp=now_ms(),
            message=None,
        )

    chunk_path = trip_storage_dir(trip_id) / f"chunk-{chunk_in.chunk_seq:05d}.json"
    write_json(chunk_path, chunk_in.samples)
    db.add(
        Chunk(
            trip_id=trip_id,
            chunk_seq=chunk_in.chunk_seq,
            idempotency_key=chunk_in.idempotency_key,
            checksum=chunk_in.checksum,
            total_chunks=chunk_in.total_chunks,
            sample_count=chunk_in.sample_count,
            samples=chunk_in.samples,
            artifact_path=str(chunk_path),
        )
    )

    trip.total_chunks_expected = max(trip.total_chunks_expected, chunk_in.total_chunks)
    trip.status = "UPLOADING"
    db.flush()
    recompute_trip_progress(trip, db)
    db.commit()

    return ChunkResponse(
        trip_id=trip_id,
        chunk_seq=chunk_in.chunk_seq,
        status="accepted",
        checksum_match=True,
        timestamp=now_ms(),
        message=None,
    )


@router.post("/trips/{trip_id}/finalize", response_model=FinalizeResponse)
def finalize_trip(
    trip_id: str,
    finalize_in: TripFinalize,
    db: Session = Depends(get_db),
    x_api_key: str | None = Header(default=None),
) -> FinalizeResponse:
    device = require_device(db, x_api_key)
    if finalize_in.trip_id != trip_id:
        raise HTTPException(status_code=400, detail="Trip ID in path does not match request body")

    trip = db.query(Trip).filter(Trip.trip_id == trip_id).first()
    if trip is None:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.device_id != device.hashed_device_id:
        raise HTTPException(status_code=403, detail="Trip does not belong to the authenticated device")

    chunks = db.query(Chunk).filter(Chunk.trip_id == trip_id).order_by(Chunk.chunk_seq.asc()).all()
    chunks_received, samples_received = recompute_trip_progress(trip, db)
    trip.total_chunks_expected = max(trip.total_chunks_expected, finalize_in.total_chunks)
    trip.total_samples = max(trip.total_samples, finalize_in.total_samples)

    complete = chunks_received == finalize_in.total_chunks and samples_received == finalize_in.total_samples
    if complete:
        trip.status = "UPLOADED"
        trip.end_time = trip.end_time or now_ms()
        trip.finalized_at = datetime.now(timezone.utc)
        trip.artifact_path = persist_trip_artifact(trip, chunks)
        message = None
        status = "completed"
    else:
        trip.status = "FAILED" if chunks_received > finalize_in.total_chunks or samples_received > finalize_in.total_samples else "UPLOADING"
        message = "Trip upload is incomplete"
        status = "incomplete"

    db.commit()
    return FinalizeResponse(
        trip_id=trip.trip_id,
        status=status,
        chunks_received=chunks_received,
        chunks_expected=finalize_in.total_chunks,
        samples_received=samples_received,
        message=message,
    )


@router.get("/trips", response_model=TripListResponse)
def list_trips(
    q: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
) -> TripListResponse:
    query = db.query(Trip).order_by(Trip.start_time.desc())
    if q:
        pattern = f"%{q}%"
        query = query.filter(
            Trip.trip_id.ilike(pattern)
            | Trip.device_model.ilike(pattern)
            | Trip.operator_name.ilike(pattern)
            | Trip.device_id.ilike(pattern)
        )
    return TripListResponse(items=[trip_to_summary(trip) for trip in query.all()])


@router.get("/trips/{trip_id}", response_model=TripDetailResponse)
def get_trip(
    trip_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
) -> TripDetailResponse:
    trip = db.query(Trip).filter(Trip.trip_id == trip_id).first()
    if trip is None:
        raise HTTPException(status_code=404, detail="Trip not found")
    return TripDetailResponse(trip=trip_to_summary(trip), quality_flags=trip.quality_flags, notes=trip.notes)


@router.get("/trips/{trip_id}/upload-status", response_model=UploadStatusResponse)
def get_trip_upload_status(trip_id: str, db: Session = Depends(get_db)) -> UploadStatusResponse:
    trip = db.query(Trip).filter(Trip.trip_id == trip_id).first()
    if trip is None:
        raise HTTPException(status_code=404, detail="Trip not found")
    chunks_received, samples_received = recompute_trip_progress(trip, db)
    db.commit()
    manifest_received = (trip_storage_dir(trip.trip_id) / "manifest.json").exists()
    return UploadStatusResponse(
        trip_id=trip.trip_id,
        status=trip.status,
        chunks_received=chunks_received,
        chunks_expected=trip.total_chunks_expected,
        samples_received=samples_received,
        manifest_received=manifest_received,
        message=None,
    )


@router.get("/trips/{trip_id}/download")
def download_trip_artifact(trip_id: str, db: Session = Depends(get_db)) -> FileResponse:
    trip = db.query(Trip).filter(Trip.trip_id == trip_id).first()
    if trip is None or not trip.artifact_path:
        raise HTTPException(status_code=404, detail="Trip artifact not found")

    artifact_path = Path(trip.artifact_path)
    if not artifact_path.exists():
        raise HTTPException(status_code=404, detail="Trip artifact file is missing")
    return FileResponse(artifact_path, media_type="application/json", filename=f"{trip_id}.json")


@router.post("/web/trips/upload", response_model=WebTripUploadResponse)
async def upload_trip_from_web(
    trip_id: str | None = Form(default=None),
    device_id: str = Form(...),
    device_model: str = Form(...),
    collector_name: str = Form(...),
    version: str = Form(default="web-1.0"),
    mount_type: str = Form(...),
    vehicle_type: str = Form(...),
    road_surface: str = Form(...),
    sampling_profile: str = Form(...),
    start_time: int = Form(...),
    end_time: int | None = Form(default=None),
    total_distance: float = Form(default=0.0),
    avg_speed: float = Form(default=0.0),
    mount_quality: float = Form(default=0.0),
    notes: str | None = Form(default=None),
    sample_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
) -> WebTripUploadResponse:
    resolved_trip_id = trip_id or f"web-{uuid.uuid4()}"
    file_bytes = await sample_file.read()
    samples = parse_samples_file(sample_file.filename, file_bytes)

    device = db.query(Device).filter(Device.hashed_device_id == device_id).first()
    if device is None:
        device = Device(
            hashed_device_id=device_id,
            model=device_model,
            os_version="Web upload",
            app_version=version,
            user_uuid=str(uuid.uuid4()),
            api_key=secrets.token_urlsafe(32),
        )
        db.add(device)
        db.commit()
        db.refresh(device)
    else:
        device.model = device_model
        device.app_version = version
        db.commit()

    manifest = TripManifest(
        trip_id=resolved_trip_id,
        version=version,
        device_id=device_id,
        mount_type=mount_type,
        vehicle_type=vehicle_type,
        road_surface=road_surface,
        sampling_profile=sampling_profile,
        start_time=start_time,
        end_time=end_time,
        total_samples=len(samples),
        total_distance=total_distance,
        avg_speed=avg_speed,
        mount_quality=mount_quality,
        quality_flags={"paused": 0, "low_gps": 0, "low_speed": 0, "stationary": 0},
    )
    trip = upsert_manifest_trip(manifest, device, db)
    trip.operator_name = collector_name
    trip.upload_source = "web"
    trip.notes = notes
    trip.status = "UPLOADING"
    db.commit()

    storage_dir = trip_storage_dir(trip.trip_id)
    source_path = storage_dir / (sample_file.filename or "samples.upload")
    source_path.write_bytes(file_bytes)

    existing_chunks = db.query(Chunk).filter(Chunk.trip_id == trip.trip_id).all()
    for existing_chunk in existing_chunks:
        db.delete(existing_chunk)
    db.commit()

    total_chunks = max(1, (len(samples) + CHUNK_SIZE - 1) // CHUNK_SIZE)
    for chunk_seq in range(total_chunks):
        start_index = chunk_seq * CHUNK_SIZE
        chunk_samples = samples[start_index:start_index + CHUNK_SIZE]
        checksum = chunk_checksum(chunk_samples)
        chunk_path = storage_dir / f"chunk-{chunk_seq:05d}.json"
        write_json(chunk_path, chunk_samples)
        db.add(
            Chunk(
                trip_id=trip.trip_id,
                chunk_seq=chunk_seq,
                idempotency_key=f"web:{trip.trip_id}:{chunk_seq}",
                checksum=checksum,
                total_chunks=total_chunks,
                sample_count=len(chunk_samples),
                samples=chunk_samples,
                artifact_path=str(chunk_path),
            )
        )

    trip.total_chunks_expected = total_chunks
    trip.total_samples = len(samples)
    db.flush()
    recompute_trip_progress(trip, db)
    trip.status = "UPLOADED"
    trip.finalized_at = datetime.now(timezone.utc)
    trip.artifact_path = persist_trip_artifact(
        trip,
        db.query(Chunk).filter(Chunk.trip_id == trip.trip_id).order_by(Chunk.chunk_seq.asc()).all(),
    )
    db.commit()

    return WebTripUploadResponse(
        trip_id=trip.trip_id,
        status=trip.status,
        chunks_received=trip.total_chunks_received,
        samples_received=trip.total_samples_received,
        artifact_path=trip.artifact_path,
    )
