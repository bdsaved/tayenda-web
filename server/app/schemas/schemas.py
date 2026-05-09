from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class DeviceRegister(BaseModel):
    hashed_device_id: str
    model: str
    os_version: str
    app_version: str


class DeviceResponse(BaseModel):
    user_uuid: str
    api_key: str
    status: str


class LoginRequest(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    username: str
    email: str
    full_name: str | None = None
    role: str

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TripManifest(BaseModel):
    trip_id: str
    version: str
    device_id: str
    mount_type: str | None = None
    vehicle_type: str | None = None
    road_surface: str | None = None
    sampling_profile: str | None = None
    start_time: int = Field(ge=0)
    end_time: int | None = Field(default=None, ge=0)
    total_samples: int = Field(default=0, ge=0)
    total_distance: float = Field(default=0.0, ge=0)
    avg_speed: float = Field(default=0.0, ge=0)
    mount_quality: float = Field(default=0.0, ge=0)
    quality_flags: dict[str, Any] | None = None


class TripResponse(BaseModel):
    trip_id: str
    server_trip_id: str
    timestamp: int
    status: str


class TripChunk(BaseModel):
    trip_id: str
    chunk_seq: int = Field(ge=0)
    idempotency_key: str
    checksum: str
    total_chunks: int = Field(gt=0)
    sample_count: int = Field(ge=0)
    samples: list[dict[str, Any]]


class ChunkResponse(BaseModel):
    trip_id: str
    chunk_seq: int
    status: str
    checksum_match: bool
    timestamp: int
    message: str | None = None


class TripFinalize(BaseModel):
    trip_id: str
    total_chunks: int = Field(gt=0)
    total_samples: int = Field(ge=0)


class FinalizeResponse(BaseModel):
    trip_id: str
    status: str
    chunks_received: int
    chunks_expected: int
    samples_received: int
    message: str | None = None


class UploadStatusResponse(FinalizeResponse):
    manifest_received: bool


class TripListItem(BaseModel):
    trip_id: str
    server_trip_id: str
    device_id: str
    device_model: str | None = None
    operator_name: str | None = None
    status: str
    upload_source: str
    start_time: int
    end_time: int | None = None
    total_samples: int
    total_samples_received: int
    total_chunks_expected: int
    total_chunks_received: int
    road_surface: str | None = None
    vehicle_type: str | None = None
    mount_type: str | None = None
    sampling_profile: str | None = None
    mount_quality: float | None = None
    avg_speed: float | None = None
    total_distance: float | None = None
    created_at: int
    finalized_at: int | None = None

    model_config = ConfigDict(from_attributes=True)


class TripListResponse(BaseModel):
    items: list[TripListItem]


class TripDetailResponse(BaseModel):
    trip: TripListItem
    quality_flags: dict[str, Any] | None = None
    notes: str | None = None


class WebTripUploadResponse(BaseModel):
    trip_id: str
    status: str
    chunks_received: int
    samples_received: int
    artifact_path: str | None = None
