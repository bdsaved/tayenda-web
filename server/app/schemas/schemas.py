from typing import Any

from pydantic import BaseModel, ConfigDict, Field

# Units used throughout the API: timestamps in epoch milliseconds, distances in
# metres (unless the field name says km), speeds in m/s, roughness in m/s^2.


# --- auth --------------------------------------------------------------------


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


# --- devices (mobile) --------------------------------------------------------


class DeviceRegister(BaseModel):
    hashed_device_id: str = Field(min_length=8, max_length=128)
    model: str = Field(max_length=200)
    os_version: str = Field(max_length=200)
    app_version: str = Field(max_length=50)


class DeviceResponse(BaseModel):
    user_uuid: str
    api_key: str
    status: str  # registered | existing | rotated


class DeviceListItem(BaseModel):
    hashed_device_id: str
    model: str
    os_version: str
    app_version: str
    created_at: int
    last_seen_at: int | None = None
    trip_count: int
    last_trip_at: int | None = None
    distance_m: float


class DeviceListResponse(BaseModel):
    items: list[DeviceListItem]


# --- trip upload (mobile) ----------------------------------------------------


class TripManifest(BaseModel):
    trip_id: str = Field(min_length=1, max_length=128)
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


class UploadStatusResponse(BaseModel):
    trip_id: str
    status: str
    chunks_received: int
    chunks_expected: int
    samples_received: int
    manifest_received: bool
    message: str | None = None


class WebTripUploadResponse(BaseModel):
    trip_id: str
    status: str
    chunks_received: int
    samples_received: int
    artifact_path: str | None = None


# --- trips (operator) --------------------------------------------------------


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
    processed_at: int | None = None
    roughness_avg: float | None = None
    good_m: float = 0.0
    fair_m: float = 0.0
    poor_m: float = 0.0
    hazard_count: int = 0
    tag_count: int = 0
    notes: str | None = None
    raw_available: bool = False


class TripListResponse(BaseModel):
    items: list[TripListItem]
    total: int


class TripDetailResponse(BaseModel):
    trip: TripListItem
    quality_flags: dict[str, Any] | None = None
    notes: str | None = None


class TripActionResponse(BaseModel):
    trip_id: str
    status: str


class HazardItem(BaseModel):
    id: int
    trip_id: str
    ts: int
    lat: float
    lon: float
    source: str
    kind: str
    magnitude: float | None = None
    speed: float | None = None

    model_config = ConfigDict(from_attributes=True)


class HazardListResponse(BaseModel):
    items: list[HazardItem]


# --- analytics ---------------------------------------------------------------


class SummaryResponse(BaseModel):
    trips_total: int
    trips_processed: int
    trips_pending: int
    trips_failed: int
    devices_total: int
    distance_km: float
    mapped_km: float
    good_km: float
    fair_km: float
    poor_km: float
    hazards_detected: int
    hazards_tagged: int
    last_upload_at: int | None = None


class HazardCluster(BaseModel):
    id: str
    lat: float
    lon: float
    kind: str
    source: str
    observations: int
    trip_count: int
    max_magnitude: float | None = None
    first_seen: int
    last_seen: int
    trip_ids: list[str]


class HazardClusterResponse(BaseModel):
    items: list[HazardCluster]


class RoadAnalysisRow(BaseModel):
    road_surface: str
    trips: int
    distance_km: float
    samples: int
    mapped_km: float
    avg_roughness: float | None = None
    good_km: float
    fair_km: float
    poor_km: float


class RoadAnalysisResponse(BaseModel):
    total_trips: int
    total_distance_km: float
    rows: list[RoadAnalysisRow]


class ProcessingHealthResponse(BaseModel):
    status: str
    interval_seconds: int
    last_run_at: int | None = None
    next_run_at: int | None = None
    processed_trips_last_run: int
    cleaned_files_last_run: int
    roughness_fair: float
    roughness_poor: float
    segment_length_m: float
    raw_retention_days: int
