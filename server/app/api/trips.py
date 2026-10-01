"""Operator endpoints for browsing and managing trips (bearer auth)."""
import gzip
import json
import secrets
import shutil
import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, Response, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Query as SAQuery
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..core.processing import process_trip, raw_path, trip_dir, write_samples_gzip
from ..models.models import Chunk, Device, Hazard, RoadSegment, Trip, TripTrack, User
from ..schemas.schemas import (
    HazardItem,
    HazardListResponse,
    TripActionResponse,
    TripDetailResponse,
    TripListResponse,
    WebTripUploadResponse,
)
from .deps import get_trip_or_404, require_operator, trip_to_item

router = APIRouter()


def filtered_trips(
    db: Session,
    q: str | None = None,
    status: str | None = None,
    device_id: str | None = None,
    since: int | None = None,
    until: int | None = None,
) -> SAQuery:
    query = db.query(Trip)
    if q:
        pattern = f"%{q.strip()}%"
        query = query.filter(
            Trip.trip_id.ilike(pattern)
            | Trip.device_model.ilike(pattern)
            | Trip.operator_name.ilike(pattern)
            | Trip.device_id.ilike(pattern)
        )
    if status:
        query = query.filter(Trip.status == status.upper())
    if device_id:
        query = query.filter(Trip.device_id == device_id)
    if since is not None:
        query = query.filter(Trip.start_time >= since)
    if until is not None:
        query = query.filter(Trip.start_time <= until)
    return query


def segments_geojson(segments: list[RoadSegment]) -> dict[str, Any]:
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": s.coordinates},
                "properties": {
                    "id": s.id,
                    "trip_id": s.trip_id,
                    "seq": s.seq,
                    "start_ts": s.start_ts,
                    "length_m": s.length_m,
                    "distance_from_start_m": s.distance_from_start_m,
                    "avg_speed": s.avg_speed,
                    "sample_count": s.sample_count,
                    "roughness": s.roughness,
                    "condition": s.condition,
                },
            }
            for s in segments
        ],
    }


def track_feature(track: TripTrack, max_points: int | None = None, detail: bool = True) -> dict[str, Any]:
    """A trip route as a GeoJSON MultiLineString Feature."""
    parts = track.parts
    if max_points is not None and track.point_count > max_points:
        stride = -(-track.point_count // max_points)
        parts = [part[::stride] + ([part[-1]] if (len(part) - 1) % stride else []) for part in parts]
    first, last = parts[0][0], parts[-1][-1]
    properties: dict[str, Any] = {
        "trip_id": track.trip_id,
        "start_ts": track.start_ts,
        "end_ts": track.end_ts,
        "start": [first[0], first[1]],
        "end": [last[0], last[1]],
        "distance_m": track.distance_m,
        "duration_s": round((track.end_ts - track.start_ts) / 1000, 1),
        "point_count": sum(len(part) for part in parts),
    }
    if detail:
        properties["timestamps"] = [[point[2] for point in part] for part in parts]
        properties["speeds"] = [[point[3] for point in part] for part in parts]
    return {
        "type": "Feature",
        "geometry": {
            "type": "MultiLineString",
            "coordinates": [[[point[0], point[1]] for point in part] for part in parts],
        },
        "properties": properties,
    }


@router.get("/trips", response_model=TripListResponse)
def list_trips(
    q: str | None = Query(default=None),
    status: str | None = Query(default=None),
    device_id: str | None = Query(default=None),
    since: int | None = Query(default=None),
    until: int | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
) -> TripListResponse:
    query = filtered_trips(db, q, status, device_id, since, until)
    total = query.count()
    trips = query.order_by(Trip.start_time.desc()).offset(offset).limit(limit).all()
    return TripListResponse(items=[trip_to_item(trip) for trip in trips], total=total)


@router.get("/trips/{trip_id}", response_model=TripDetailResponse)
def get_trip(
    trip_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
) -> TripDetailResponse:
    trip = get_trip_or_404(db, trip_id)
    return TripDetailResponse(trip=trip_to_item(trip), quality_flags=trip.quality_flags, notes=trip.notes)


@router.get("/trips/{trip_id}/segments")
def get_trip_segments(
    trip_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
) -> dict[str, Any]:
    get_trip_or_404(db, trip_id)
    segments = (
        db.query(RoadSegment).filter(RoadSegment.trip_id == trip_id).order_by(RoadSegment.seq.asc()).all()
    )
    return segments_geojson(segments)


@router.get("/trips/{trip_id}/track")
def get_trip_track(
    trip_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
) -> dict[str, Any]:
    get_trip_or_404(db, trip_id)
    track = db.get(TripTrack, trip_id)
    if track is None or not track.parts:
        raise HTTPException(status_code=404, detail="No GPS track for this trip")
    return track_feature(track)


@router.get("/trips/{trip_id}/hazards", response_model=HazardListResponse)
def get_trip_hazards(
    trip_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
) -> HazardListResponse:
    get_trip_or_404(db, trip_id)
    hazards = db.query(Hazard).filter(Hazard.trip_id == trip_id).order_by(Hazard.ts.asc()).all()
    return HazardListResponse(items=[HazardItem.model_validate(h) for h in hazards])


@router.get("/trips/{trip_id}/download")
def download_trip_raw(
    trip_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
) -> FileResponse:
    get_trip_or_404(db, trip_id)
    path = raw_path(trip_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Raw data is no longer retained")
    return FileResponse(path, media_type="application/gzip", filename=f"{trip_id}.ndjson.gz")


@router.post("/trips/{trip_id}/reprocess", response_model=TripActionResponse)
def reprocess_trip(
    trip_id: str,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
) -> TripActionResponse:
    trip = get_trip_or_404(db, trip_id)
    if not raw_path(trip_id).exists():
        raise HTTPException(status_code=409, detail="Raw data is no longer retained, so the trip cannot be reprocessed")
    trip.status = "STORED"
    trip.processing_version = 0
    db.commit()
    background.add_task(process_trip, trip_id)
    return TripActionResponse(trip_id=trip_id, status=trip.status)


@router.delete("/trips/{trip_id}", status_code=204)
def delete_trip(
    trip_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
) -> Response:
    trip = get_trip_or_404(db, trip_id)
    for model in (RoadSegment, Hazard, TripTrack, Chunk):
        db.query(model).filter(model.trip_id == trip_id).delete(synchronize_session=False)
    db.delete(trip)
    db.commit()
    shutil.rmtree(trip_dir(trip_id), ignore_errors=True)
    return Response(status_code=204)


def parse_samples_file(filename: str | None, content: bytes) -> list[dict[str, Any]]:
    file_name = (filename or "").lower()
    try:
        payload = gzip.decompress(content) if file_name.endswith(".gz") else content
        text = payload.decode("utf-8").strip()
    except (OSError, EOFError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=400, detail=f"Could not read the sample file: {exc}") from exc
    if not text:
        raise HTTPException(status_code=400, detail="Uploaded sample file is empty")

    try:
        if text.startswith("[") or (text.startswith("{") and len(text.splitlines()) == 1):
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                parsed = parsed.get("samples")
            if not isinstance(parsed, list):
                raise HTTPException(status_code=400, detail="JSON sample upload must contain a samples array")
            return [item for item in parsed if isinstance(item, dict)]
        return [json.loads(line) for line in text.splitlines() if line.strip()]
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Sample file is not valid JSON/NDJSON: {exc.msg} (line {exc.lineno})") from exc


@router.post("/web/trips/upload", response_model=WebTripUploadResponse)
def upload_trip_from_web(
    background: BackgroundTasks,
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
    mount_quality: float = Form(default=0.0),
    notes: str | None = Form(default=None),
    sample_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
) -> WebTripUploadResponse:
    resolved_trip_id = (trip_id or "").strip() or f"web-{uuid.uuid4()}"
    if db.get(Trip, resolved_trip_id) is not None:
        raise HTTPException(status_code=409, detail=f"Trip {resolved_trip_id} already exists; leave Trip ID blank to generate one")

    samples = parse_samples_file(sample_file.filename, sample_file.file.read())
    if not samples:
        raise HTTPException(status_code=400, detail="Uploaded sample file has no samples")

    device = db.get(Device, device_id)
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

    count = write_samples_gzip(raw_path(resolved_trip_id), samples)
    db.add(
        Trip(
            trip_id=resolved_trip_id,
            version=version,
            device_id=device_id,
            device_model=device_model,
            operator_name=collector_name,
            mount_type=mount_type,
            vehicle_type=vehicle_type,
            road_surface=road_surface,
            sampling_profile=sampling_profile,
            start_time=start_time,
            end_time=end_time,
            mount_quality=mount_quality,
            total_samples=count,
            total_samples_received=count,
            total_chunks_expected=1,
            total_chunks_received=1,
            status="STORED",
            upload_source="web",
            notes=notes,
            artifact_path=str(raw_path(resolved_trip_id)),
        )
    )
    db.commit()

    background.add_task(process_trip, resolved_trip_id)
    return WebTripUploadResponse(
        trip_id=resolved_trip_id,
        status="stored",
        chunks_received=1,
        samples_received=count,
        artifact_path=None,
    )
