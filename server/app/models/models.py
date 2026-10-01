from datetime import datetime, timezone
import uuid

from sqlalchemy import BigInteger, Boolean, DateTime, Float, ForeignKey, Index, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String, nullable=True)
    role: Mapped[str] = mapped_column(String, default="user", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)


class Device(Base):
    __tablename__ = "devices"

    hashed_device_id: Mapped[str] = mapped_column(String, primary_key=True)
    model: Mapped[str] = mapped_column(String, nullable=False)
    os_version: Mapped[str] = mapped_column(String, nullable=False)
    app_version: Mapped[str] = mapped_column(String, nullable=False)
    user_uuid: Mapped[str] = mapped_column(String, default=lambda: str(uuid.uuid4()), nullable=False)
    api_key: Mapped[str] = mapped_column(String, nullable=False)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)


class Trip(Base):
    __tablename__ = "trips"
    __table_args__ = (
        Index("ix_trips_status", "status"),
        Index("ix_trips_start_time", "start_time"),
        Index("ix_trips_road_surface", "road_surface"),
    )

    trip_id: Mapped[str] = mapped_column(String, primary_key=True)
    server_trip_id: Mapped[str] = mapped_column(String, default=lambda: f"srv_{uuid.uuid4().hex}", nullable=False)
    version: Mapped[str] = mapped_column(String, nullable=False)
    device_id: Mapped[str] = mapped_column(String, ForeignKey("devices.hashed_device_id"), nullable=False)
    device_model: Mapped[str | None] = mapped_column(String, nullable=True)
    operator_name: Mapped[str | None] = mapped_column(String, nullable=True)
    mount_type: Mapped[str | None] = mapped_column(String, nullable=True)
    vehicle_type: Mapped[str | None] = mapped_column(String, nullable=True)
    road_surface: Mapped[str | None] = mapped_column(String, nullable=True)
    sampling_profile: Mapped[str | None] = mapped_column(String, nullable=True)
    start_time: Mapped[int] = mapped_column(BigInteger, nullable=False)
    end_time: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    total_samples: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_distance: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    avg_speed: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    mount_quality: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    quality_flags: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String, default="PENDING", nullable=False)
    total_chunks_expected: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_chunks_received: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_samples_received: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    upload_source: Mapped[str] = mapped_column(String, default="mobile", nullable=False)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)
    finalized_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    artifact_path: Mapped[str | None] = mapped_column(String, nullable=True)
    # Results of road-roughness processing (see app/core/roughness.py).
    processing_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    roughness_avg: Mapped[float | None] = mapped_column(Float, nullable=True)
    good_m: Mapped[float] = mapped_column(Float, default=0.0, server_default="0", nullable=False)
    fair_m: Mapped[float] = mapped_column(Float, default=0.0, server_default="0", nullable=False)
    poor_m: Mapped[float] = mapped_column(Float, default=0.0, server_default="0", nullable=False)
    hazard_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    tag_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)


class RoadSegment(Base):
    """A ~50 m stretch of a trip with its measured roughness."""

    __tablename__ = "road_segments"
    __table_args__ = (
        Index("ix_road_segments_trip_id", "trip_id"),
        Index("ix_road_segments_start_ts", "start_ts"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trip_id: Mapped[str] = mapped_column(String, ForeignKey("trips.trip_id", ondelete="CASCADE"), nullable=False)
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    start_ts: Mapped[int] = mapped_column(BigInteger, nullable=False)
    length_m: Mapped[float] = mapped_column(Float, nullable=False)
    distance_from_start_m: Mapped[float] = mapped_column(Float, nullable=False)
    avg_speed: Mapped[float] = mapped_column(Float, nullable=False)
    sample_count: Mapped[int] = mapped_column(Integer, nullable=False)
    roughness: Mapped[float] = mapped_column(Float, nullable=False)
    condition: Mapped[str] = mapped_column(String, nullable=False)
    # [[lon, lat], ...] in GeoJSON order.
    coordinates: Mapped[list] = mapped_column(JSON, nullable=False)


class Hazard(Base):
    """A point hazard: a detected vertical jolt or a driver-tagged report."""

    __tablename__ = "hazards"
    __table_args__ = (
        Index("ix_hazards_trip_id", "trip_id"),
        Index("ix_hazards_ts", "ts"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trip_id: Mapped[str] = mapped_column(String, ForeignKey("trips.trip_id", ondelete="CASCADE"), nullable=False)
    ts: Mapped[int] = mapped_column(BigInteger, nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lon: Mapped[float] = mapped_column(Float, nullable=False)
    source: Mapped[str] = mapped_column(String, nullable=False)  # "detected" | "tagged"
    kind: Mapped[str] = mapped_column(String, nullable=False)
    magnitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    speed: Mapped[float | None] = mapped_column(Float, nullable=True)


class TripTrack(Base):
    """The full GPS route of a trip, kept after the raw file is deleted."""

    __tablename__ = "trip_tracks"

    trip_id: Mapped[str] = mapped_column(String, ForeignKey("trips.trip_id", ondelete="CASCADE"), primary_key=True)
    # [[[lon, lat, ts, speed], ...], ...] -- one list per continuous part.
    parts: Mapped[list] = mapped_column(JSON, nullable=False)
    point_count: Mapped[int] = mapped_column(Integer, nullable=False)
    distance_m: Mapped[float] = mapped_column(Float, nullable=False)
    start_ts: Mapped[int] = mapped_column(BigInteger, nullable=False)
    end_ts: Mapped[int] = mapped_column(BigInteger, nullable=False)


class Chunk(Base):
    """Legacy chunked-upload rows. No longer written; kept so old data stays readable."""

    __tablename__ = "chunks"
    __table_args__ = (UniqueConstraint("trip_id", "chunk_seq", name="uq_chunks_trip_seq"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    trip_id: Mapped[str] = mapped_column(String, ForeignKey("trips.trip_id"), nullable=False)
    chunk_seq: Mapped[int] = mapped_column(Integer, nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String, nullable=False)
    checksum: Mapped[str] = mapped_column(String, nullable=False)
    total_chunks: Mapped[int] = mapped_column(Integer, nullable=False)
    sample_count: Mapped[int] = mapped_column(Integer, nullable=False)
    samples: Mapped[list] = mapped_column(JSON, nullable=False)
    artifact_path: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
