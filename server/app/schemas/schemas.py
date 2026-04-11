from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
import uuid

class DeviceRegister(BaseModel):
    hashed_device_id: str
    model: str
    os_version: str
    app_version: str

class DeviceResponse(BaseModel):
    user_uuid: uuid.UUID
    api_key: str
    status: str

class TripManifest(BaseModel):
    trip_id: uuid.UUID
    version: str
    device_id: str
    mount_type: Optional[str] = None
    vehicle_type: Optional[str] = None
    road_surface: Optional[str] = None
    sampling_profile: Optional[str] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    total_samples: Optional[int] = 0
    total_distance: Optional[float] = 0.0
    avg_speed: Optional[float] = 0.0
    mount_quality: Optional[float] = 0.0
    quality_flags: Optional[Dict[str, Any]] = None

class TripResponse(BaseModel):
    trip_id: uuid.UUID
    server_trip_id: uuid.UUID
    timestamp: datetime
    status: str

class TripChunk(BaseModel):
    trip_id: uuid.UUID
    chunk_seq: int
    idempotency_key: str
    checksum: str
    total_chunks: int
    sample_count: int
    samples: list

class ChunkResponse(BaseModel):
    trip_id: uuid.UUID
    chunk_seq: int
    status: str
    checksum_match: bool
    timestamp: datetime
    message: Optional[str] = None

class TripFinalize(BaseModel):
    trip_id: uuid.UUID
    total_chunks: int
    total_samples: int

class FinalizeResponse(BaseModel):
    trip_id: uuid.UUID
    status: str
    chunks_received: int
    chunks_expected: int
    samples_received: int
    message: Optional[str] = None
