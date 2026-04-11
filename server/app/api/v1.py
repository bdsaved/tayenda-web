from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional
import uuid
import secrets
import hashlib
import json
from datetime import datetime

from ..core.db import get_db
from ..models.models import Device, Trip, Chunk
from ..schemas.schemas import DeviceRegister, DeviceResponse, TripManifest, TripResponse, TripChunk, ChunkResponse, TripFinalize, FinalizeResponse

router = APIRouter(prefix="/v1")

@router.post("/devices/register", response_model=DeviceResponse)
def register_device(device_in: DeviceRegister, db: Session = Depends(get_db)):
    # Check if device already exists
    device = db.query(Device).filter(Device.hashed_device_id == device_in.hashed_device_id).first()
    
    if device:
        status = "existing"
    else:
        status = "registered"
        # Generate a simple API key for the device
        api_key = secrets.token_urlsafe(32)
        device = Device(
            hashed_device_id=device_in.hashed_device_id,
            model=device_in.model,
            os_version=device_in.os_version,
            app_version=device_in.app_version,
            user_uuid=uuid.uuid4(),
            api_key=api_key
        )
        db.add(device)
        db.commit()
        db.refresh(device)
    
    return DeviceResponse(
        user_uuid=device.user_uuid,
        api_key=device.api_key,
        status=status
    )

@router.post("/trips/manifest", response_model=TripResponse)
def create_trip_manifest(
    manifest_in: TripManifest, 
    db: Session = Depends(get_db),
    x_api_key: str = Header(...)
):
    # Validate API Key
    device = db.query(Device).filter(Device.api_key == x_api_key).first()
    if not device:
        raise HTTPException(status_code=401, detail="Invalid API Key")
    
    trip = db.query(Trip).filter(Trip.trip_id == manifest_in.trip_id).first()
    
    if not trip:
        trip = Trip(
            trip_id=manifest_in.trip_id,
            version=manifest_in.version,
            device_id=manifest_in.device_id,
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
            status="accepted"
        )
        db.add(trip)
    else:
        trip.version = manifest_in.version
        trip.mount_type = manifest_in.mount_type
        trip.vehicle_type = manifest_in.vehicle_type
        trip.road_surface = manifest_in.road_surface
        trip.sampling_profile = manifest_in.sampling_profile
    
    db.commit()
    db.refresh(trip)
    
    return TripResponse(
        trip_id=trip.trip_id,
        server_trip_id=trip.trip_id,
        timestamp=datetime.now(),
        status="accepted"
    )

@router.post("/trips/{tripId}/chunks", response_model=ChunkResponse)
def upload_chunk(
    tripId: uuid.UUID,
    chunk_in: TripChunk,
    db: Session = Depends(get_db),
    x_api_key: str = Header(...)
):
    # Validate API Key
    device = db.query(Device).filter(Device.api_key == x_api_key).first()
    if not device:
        raise HTTPException(status_code=401, detail="Invalid API Key")
    
    # Verify trip exists
    trip = db.query(Trip).filter(Trip.trip_id == tripId).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Verify checksum
    samples_json = json.dumps(chunk_in.samples, separators=(',', ':'))
    checksum = hashlib.sha256(samples_json.encode()).hexdigest()
    checksum_match = checksum == chunk_in.checksum

    # Check for duplicate chunk
    existing_chunk = db.query(Chunk).filter(
        Chunk.trip_id == tripId, 
        Chunk.chunk_seq == chunk_in.chunk_seq
    ).first()

    if not existing_chunk:
        chunk = Chunk(
            trip_id=tripId,
            chunk_seq=chunk_in.chunk_seq,
            idempotency_key=chunk_in.idempotency_key,
            checksum=chunk_in.checksum,
            total_chunks=chunk_in.total_chunks,
            sample_count=chunk_in.sample_count,
            samples=chunk_in.samples
        )
        db.add(chunk)
        db.commit()
        status = "accepted"
    else:
        status = "duplicate"

    return ChunkResponse(
        trip_id=tripId,
        chunk_seq=chunk_in.chunk_seq,
        status=status,
        checksum_match=checksum_match,
        timestamp=datetime.now()
    )

@router.post("/trips/{tripId}/finalize", response_model=FinalizeResponse)
def finalize_trip(
    tripId: uuid.UUID,
    finalize_in: TripFinalize,
    db: Session = Depends(get_db),
    x_api_key: str = Header(...)
):
    # Validate API Key
    device = db.query(Device).filter(Device.api_key == x_api_key).first()
    if not device:
        raise HTTPException(status_code=401, detail="Invalid API Key")

    trip = db.query(Trip).filter(Trip.trip_id == tripId).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Count received chunks and samples
    chunks = db.query(Chunk).filter(Chunk.trip_id == tripId).all()
    chunks_received = len(chunks)
    samples_received = sum(c.sample_count for c in chunks)

    if chunks_received >= finalize_in.total_chunks:
        trip.status = "completed"
        db.commit()
        status = "completed"
    else:
        status = "incomplete"

    return FinalizeResponse(
        trip_id=tripId,
        status=status,
        chunks_received=chunks_received,
        chunks_expected=finalize_in.total_chunks,
        samples_received=samples_received
    )
