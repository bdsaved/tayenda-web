"""Operator analytics: summary, road segments, hazard clusters, exports."""
import csv
import io
import json
import math
from collections import Counter, defaultdict
from typing import Any

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.db import get_db
from ..core.processing import get_processing_health
from ..core.roughness import haversine_m
from ..models.models import Device, Hazard, RoadSegment, Trip, TripTrack, User
from ..schemas.schemas import (
    DeviceListItem,
    DeviceListResponse,
    HazardCluster,
    HazardClusterResponse,
    ProcessingHealthResponse,
    RoadAnalysisResponse,
    RoadAnalysisRow,
    SummaryResponse,
)
from .deps import require_operator, to_millis, trip_to_item
from .trips import filtered_trips, segments_geojson, track_feature

router = APIRouter()

PENDING_STATUSES = ("PENDING", "UPLOADING", "STORED", "PROCESSING")


@router.get("/devices", response_model=DeviceListResponse)
def list_devices(
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
) -> DeviceListResponse:
    stats = {
        device_id: (count, last_trip, distance)
        for device_id, count, last_trip, distance in db.query(
            Trip.device_id,
            func.count(Trip.trip_id),
            func.max(Trip.start_time),
            func.coalesce(func.sum(Trip.total_distance), 0.0),
        ).group_by(Trip.device_id)
    }
    items = []
    for device in db.query(Device).all():
        count, last_trip, distance = stats.get(device.hashed_device_id, (0, None, 0.0))
        items.append(
            DeviceListItem(
                hashed_device_id=device.hashed_device_id,
                model=device.model,
                os_version=device.os_version,
                app_version=device.app_version,
                created_at=to_millis(device.created_at) or 0,
                last_seen_at=to_millis(device.last_seen_at or device.updated_at),
                trip_count=int(count),
                last_trip_at=last_trip,
                distance_m=float(distance or 0.0),
            )
        )
    items.sort(key=lambda d: d.last_seen_at or 0, reverse=True)
    return DeviceListResponse(items=items)


@router.get("/analytics/summary", response_model=SummaryResponse)
def summary(
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
) -> SummaryResponse:
    by_status = dict(db.query(Trip.status, func.count(Trip.trip_id)).group_by(Trip.status).all())
    distance, good, fair, poor, last_upload = db.query(
        func.coalesce(func.sum(Trip.total_distance), 0.0),
        func.coalesce(func.sum(Trip.good_m), 0.0),
        func.coalesce(func.sum(Trip.fair_m), 0.0),
        func.coalesce(func.sum(Trip.poor_m), 0.0),
        func.max(Trip.finalized_at),
    ).one()
    hazards = dict(db.query(Hazard.source, func.count(Hazard.id)).group_by(Hazard.source).all())
    km = lambda metres: round(float(metres or 0.0) / 1000.0, 2)  # noqa: E731
    return SummaryResponse(
        trips_total=sum(by_status.values()),
        trips_processed=by_status.get("UPLOADED", 0),
        trips_pending=sum(by_status.get(s, 0) for s in PENDING_STATUSES),
        trips_failed=by_status.get("FAILED", 0),
        devices_total=db.query(func.count(Device.hashed_device_id)).scalar() or 0,
        distance_km=km(distance),
        mapped_km=km((good or 0) + (fair or 0) + (poor or 0)),
        good_km=km(good),
        fair_km=km(fair),
        poor_km=km(poor),
        hazards_detected=hazards.get("detected", 0),
        hazards_tagged=hazards.get("tagged", 0),
        last_upload_at=to_millis(last_upload),
    )


def query_segments(
    db: Session,
    since: int | None,
    until: int | None,
    trip_id: str | None,
    condition: str | None,
    limit: int,
) -> list[RoadSegment]:
    query = db.query(RoadSegment)
    if trip_id:
        query = query.filter(RoadSegment.trip_id == trip_id)
    if since is not None:
        query = query.filter(RoadSegment.start_ts >= since)
    if until is not None:
        query = query.filter(RoadSegment.start_ts <= until)
    if condition:
        query = query.filter(RoadSegment.condition == condition.upper())
    return query.order_by(RoadSegment.start_ts.desc()).limit(limit).all()


@router.get("/analytics/segments")
def road_segments(
    since: int | None = Query(default=None),
    until: int | None = Query(default=None),
    trip_id: str | None = Query(default=None),
    condition: str | None = Query(default=None),
    limit: int = Query(default=20000, ge=1, le=100000),
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
) -> dict[str, Any]:
    return segments_geojson(query_segments(db, since, until, trip_id, condition, limit))


@router.get("/analytics/tracks")
def trip_tracks(
    since: int | None = Query(default=None),
    until: int | None = Query(default=None),
    device_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
) -> dict[str, Any]:
    """Recent trip routes, simplified for an overview map."""
    query = db.query(TripTrack).join(Trip, Trip.trip_id == TripTrack.trip_id)
    if since is not None:
        query = query.filter(TripTrack.end_ts >= since)
    if until is not None:
        query = query.filter(TripTrack.start_ts <= until)
    if device_id:
        query = query.filter(Trip.device_id == device_id)
    tracks = query.order_by(TripTrack.start_ts.desc()).limit(limit).all()
    return {
        "type": "FeatureCollection",
        "features": [track_feature(t, max_points=400, detail=False) for t in tracks if t.parts],
    }


def cluster_hazards(hazards: list[Hazard], radius_m: float) -> list[HazardCluster]:
    """Greedy grid clustering: reports within ``radius_m`` merge into one hazard.

    Detected jolts and driver tags are clustered separately so a confirmed tag
    is never hidden inside a cluster of sensor detections.
    """
    cell_deg = radius_m / 111_000.0
    groups: list[dict[str, Any]] = []
    grid: dict[tuple[str, int, int], list[int]] = defaultdict(list)

    for hazard in sorted(hazards, key=lambda h: h.ts):
        cx, cy = math.floor(hazard.lat / cell_deg), math.floor(hazard.lon / cell_deg)
        match = None
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for index in grid.get((hazard.source, cx + dx, cy + dy), ()):
                    group = groups[index]
                    if haversine_m(group["lat"], group["lon"], hazard.lat, hazard.lon) <= radius_m:
                        match = index
                        break
                if match is not None:
                    break
            if match is not None:
                break

        if match is None:
            groups.append({"lat": hazard.lat, "lon": hazard.lon, "source": hazard.source, "members": [hazard]})
            grid[(hazard.source, cx, cy)].append(len(groups) - 1)
        else:
            group = groups[match]
            group["members"].append(hazard)
            n = len(group["members"])
            group["lat"] += (hazard.lat - group["lat"]) / n
            group["lon"] += (hazard.lon - group["lon"]) / n

    clusters = []
    for group in groups:
        members: list[Hazard] = group["members"]
        trip_ids = sorted({m.trip_id for m in members})
        magnitudes = [m.magnitude for m in members if m.magnitude is not None]
        clusters.append(
            HazardCluster(
                id=f"{group['source']}-{group['lat']:.5f}-{group['lon']:.5f}",
                lat=round(group["lat"], 6),
                lon=round(group["lon"], 6),
                kind=Counter(m.kind for m in members).most_common(1)[0][0],
                source=group["source"],
                observations=len(members),
                trip_count=len(trip_ids),
                max_magnitude=max(magnitudes) if magnitudes else None,
                first_seen=min(m.ts for m in members),
                last_seen=max(m.ts for m in members),
                trip_ids=trip_ids,
            )
        )
    clusters.sort(key=lambda c: (c.trip_count, c.observations, c.max_magnitude or 0), reverse=True)
    return clusters


def query_hazard_clusters(
    db: Session,
    since: int | None,
    until: int | None,
    source: str | None,
    kind: str | None,
    limit: int,
) -> list[HazardCluster]:
    query = db.query(Hazard)
    if since is not None:
        query = query.filter(Hazard.ts >= since)
    if until is not None:
        query = query.filter(Hazard.ts <= until)
    if source:
        query = query.filter(Hazard.source == source.lower())
    if kind:
        query = query.filter(Hazard.kind == kind.upper())
    return cluster_hazards(query.all(), settings.HAZARD_CLUSTER_RADIUS_M)[:limit]


@router.get("/analytics/hazards", response_model=HazardClusterResponse)
def hazard_clusters(
    since: int | None = Query(default=None),
    until: int | None = Query(default=None),
    source: str | None = Query(default=None),
    kind: str | None = Query(default=None),
    limit: int = Query(default=500, ge=1, le=5000),
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
) -> HazardClusterResponse:
    return HazardClusterResponse(items=query_hazard_clusters(db, since, until, source, kind, limit))


@router.get("/analytics/roads", response_model=RoadAnalysisResponse)
def roads_analysis(
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
) -> RoadAnalysisResponse:
    grouped: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    total_distance = 0.0
    trips = db.query(Trip).all()
    for trip in trips:
        row = grouped[(trip.road_surface or "UNSPECIFIED").upper()]
        mapped = (trip.good_m or 0) + (trip.fair_m or 0) + (trip.poor_m or 0)
        row["trips"] += 1
        row["distance_m"] += trip.total_distance or 0.0
        row["samples"] += trip.total_samples_received or 0
        row["good_m"] += trip.good_m or 0
        row["fair_m"] += trip.fair_m or 0
        row["poor_m"] += trip.poor_m or 0
        row["mapped_m"] += mapped
        if trip.roughness_avg is not None:
            row["rough_weighted"] += trip.roughness_avg * mapped
        total_distance += trip.total_distance or 0.0

    rows = [
        RoadAnalysisRow(
            road_surface=surface,
            trips=int(v["trips"]),
            distance_km=round(v["distance_m"] / 1000, 2),
            samples=int(v["samples"]),
            mapped_km=round(v["mapped_m"] / 1000, 2),
            avg_roughness=round(v["rough_weighted"] / v["mapped_m"], 3) if v["mapped_m"] else None,
            good_km=round(v["good_m"] / 1000, 2),
            fair_km=round(v["fair_m"] / 1000, 2),
            poor_km=round(v["poor_m"] / 1000, 2),
        )
        for surface, v in grouped.items()
    ]
    rows.sort(key=lambda r: r.distance_km, reverse=True)
    return RoadAnalysisResponse(
        total_trips=len(trips), total_distance_km=round(total_distance / 1000, 2), rows=rows
    )


@router.get("/analytics/processing-health", response_model=ProcessingHealthResponse)
def processing_health(_: User = Depends(require_operator)) -> ProcessingHealthResponse:
    health = get_processing_health()
    return ProcessingHealthResponse(
        status=str(health.get("status", "idle")),
        interval_seconds=int(health.get("interval_seconds", settings.PROCESS_INTERVAL_SECONDS)),
        last_run_at=health.get("last_run_at"),
        next_run_at=health.get("next_run_at"),
        processed_trips_last_run=int(health.get("processed_trips_last_run", 0)),
        cleaned_files_last_run=int(health.get("cleaned_files_last_run", 0)),
        roughness_fair=settings.ROUGHNESS_FAIR,
        roughness_poor=settings.ROUGHNESS_POOR,
        segment_length_m=settings.SEGMENT_LENGTH_M,
        raw_retention_days=settings.RAW_RETENTION_DAYS,
    )


# --- exports -----------------------------------------------------------------


def attachment(content: str, filename: str, media_type: str) -> Response:
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def to_csv(header: list[str], rows: list[list[Any]]) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(header)
    writer.writerows(rows)
    return buffer.getvalue()


@router.get("/export/trips.csv")
def export_trips(
    q: str | None = Query(default=None),
    status: str | None = Query(default=None),
    device_id: str | None = Query(default=None),
    since: int | None = Query(default=None),
    until: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
) -> Response:
    trips = filtered_trips(db, q, status, device_id, since, until).order_by(Trip.start_time.desc()).all()
    header = [
        "trip_id", "status", "device_id", "device_model", "operator_name", "start_time", "end_time",
        "distance_m", "avg_speed_mps", "road_surface", "vehicle_type", "mount_type", "samples",
        "roughness_avg", "good_m", "fair_m", "poor_m", "jolts", "tags", "notes",
    ]
    rows = []
    for trip in trips:
        item = trip_to_item(trip)
        rows.append([
            item.trip_id, item.status, item.device_id, item.device_model, item.operator_name,
            item.start_time, item.end_time, item.total_distance, item.avg_speed, item.road_surface,
            item.vehicle_type, item.mount_type, item.total_samples_received, item.roughness_avg,
            item.good_m, item.fair_m, item.poor_m, item.hazard_count, item.tag_count, item.notes,
        ])
    return attachment(to_csv(header, rows), "tayenda-trips.csv", "text/csv")


@router.get("/export/hazards.csv")
def export_hazards(
    since: int | None = Query(default=None),
    until: int | None = Query(default=None),
    source: str | None = Query(default=None),
    kind: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
) -> Response:
    clusters = query_hazard_clusters(db, since, until, source, kind, limit=100_000)
    header = [
        "lat", "lon", "kind", "source", "observations", "trip_count", "max_magnitude",
        "first_seen", "last_seen", "trip_ids",
    ]
    rows = [
        [c.lat, c.lon, c.kind, c.source, c.observations, c.trip_count, c.max_magnitude,
         c.first_seen, c.last_seen, " ".join(c.trip_ids)]
        for c in clusters
    ]
    return attachment(to_csv(header, rows), "tayenda-hazards.csv", "text/csv")


@router.get("/export/segments.geojson")
def export_segments(
    since: int | None = Query(default=None),
    until: int | None = Query(default=None),
    trip_id: str | None = Query(default=None),
    condition: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_operator),
) -> Response:
    payload = segments_geojson(query_segments(db, since, until, trip_id, condition, limit=1_000_000))
    return attachment(json.dumps(payload, separators=(",", ":")), "tayenda-segments.geojson", "application/geo+json")
