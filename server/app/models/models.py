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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)


class Chunk(Base):
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
