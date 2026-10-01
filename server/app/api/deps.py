from datetime import datetime, timezone

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..core.processing import raw_path
from ..core.security import decode_token
from ..models.models import Device, Trip, User
from ..schemas.schemas import TripListItem


def now_ms() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def to_millis(value: datetime | None) -> int | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return int(value.timestamp() * 1000)


def require_device(
    x_api_key: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Device:
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing x-api-key")
    device = db.query(Device).filter(Device.api_key == x_api_key).first()
    if device is None:
        raise HTTPException(status_code=401, detail="Invalid API key")
    device.last_seen_at = datetime.now(timezone.utc)
    db.commit()
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
        raise HTTPException(status_code=401, detail="Session expired, please sign in again")
    user = db.query(User).filter(User.username == username, User.is_active.is_(True)).first()
    if user is None:
        raise HTTPException(status_code=401, detail="Operator account not found")
    return user


def get_trip_or_404(db: Session, trip_id: str) -> Trip:
    trip = db.get(Trip, trip_id)
    if trip is None:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


def trip_to_item(trip: Trip) -> TripListItem:
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
        processed_at=to_millis(trip.processed_at),
        roughness_avg=trip.roughness_avg,
        good_m=trip.good_m or 0.0,
        fair_m=trip.fair_m or 0.0,
        poor_m=trip.poor_m or 0.0,
        hazard_count=trip.hazard_count or 0,
        tag_count=trip.tag_count or 0,
        notes=trip.notes,
        raw_available=raw_path(trip.trip_id).exists(),
    )
