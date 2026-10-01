"""Road roughness analysis of a recorded trip.

Input is the phone's ``trip.ndjson.gz``: one JSON object per line, either a
sensor sample::

    {"ts": 1779519462352, "lat": -15.83, "lon": 35.10, "spd": 8.86, "gps_acc": 3.8,
     "fix_ts": 1779519462000, "acc_d": [x, y, z], "rot": [x, y, z, w, acc], ...}

where ``acc_d`` is linear acceleration (gravity removed) in the device frame and
``rot`` is the Android rotation-vector quaternion, or a driver hazard tag::

    {"type": "tag", "ts": ..., "lat": ..., "lon": ..., "tag": "POTHOLE"}

The trip is cut into fixed-length segments along the GPS track. Each segment's
roughness is the RMS of earth-frame vertical acceleration, in m/s^2. Single
vertical spikes above a threshold are reported as jolts (likely potholes).
"""
from __future__ import annotations

import json
import math
import zlib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterator

from .config import settings

# Bump when the algorithm changes so stored trips are re-processed.
PROCESSING_VERSION = 1

GZIP_MAGIC = b"\x1f\x8b\x08"
TAG_KINDS = {"POTHOLE", "ROUGH", "FLOOD", "OBSTRUCTION", "OTHER"}

MAX_FIX_ACCURACY_M = 30.0
MAX_IMPLIED_SPEED_MPS = 60.0
# Longer gaps between fixes end a roughness segment ...
MAX_FIX_GAP_MS = 10_000
# ... but the drawn route only breaks for real recording gaps. The first app
# version slowed GPS to one fix per 30 s while stationary.
MAX_TRACK_GAP_MS = 300_000
MAX_REJECTED_FIXES = 3
MIN_SEGMENT_SAMPLES = 10
JOLT_MERGE_MS = 1_500
# Upper bound on stored route points per trip (1 Hz GPS ~ 1.4 hours).
MAX_TRACK_POINTS = 5_000


# --------------------------------------------------------------------------- #
# Reading
# --------------------------------------------------------------------------- #


@dataclass
class ReadReport:
    damaged: bool = False
    bad_lines: int = 0


def _decompressed_chunks(data: bytes, report: ReadReport) -> Iterator[bytes | None]:
    """Yield decompressed bytes from every gzip member in ``data``.

    A damaged or truncated member is cut short and decoding resumes at the next
    gzip header, if any. ``None`` is yielded at each such break so the caller
    can drop the partial line that preceded it.
    """
    pos = 0
    step = 1 << 20
    while pos < len(data):
        decoder = zlib.decompressobj(wbits=31)
        fed = 0
        failed = False
        try:
            while not decoder.eof and pos + fed < len(data):
                piece = data[pos + fed : pos + fed + step]
                fed += len(piece)
                out = decoder.decompress(piece)
                if out:
                    yield out
            if decoder.eof:
                tail = decoder.flush()
                if tail:
                    yield tail
            else:
                # Ran out of input mid-member: the file was never closed, or
                # this member was cut short and the decoder read on into the
                # next member as if it were more of this one.
                failed = True
        except zlib.error:
            failed = True

        if failed:
            report.damaged = True
            yield None
            nxt = data.find(GZIP_MAGIC, pos + 1)
            if nxt < 0:
                return
            pos = nxt
            continue

        pos = pos + fed - len(decoder.unused_data)
        # Ignore trailing padding that is not another member.
        if not data.startswith(GZIP_MAGIC, pos):
            nxt = data.find(GZIP_MAGIC, pos)
            if nxt < 0:
                return
            report.damaged = True
            pos = nxt


def iter_records(data: bytes, report: ReadReport | None = None) -> Iterator[dict[str, Any]]:
    """Yield every decodable JSON object in a (possibly damaged) NDJSON gzip."""
    report = report if report is not None else ReadReport()
    buffer = b""
    for chunk in _decompressed_chunks(data, report):
        if chunk is None:
            # Whatever was buffered belongs to a line that was cut off.
            if buffer:
                report.bad_lines += 1
            buffer = b""
            continue
        buffer += chunk
        lines = buffer.split(b"\n")
        buffer = lines.pop()
        for line in lines:
            record = _parse_line(line, report)
            if record is not None:
                yield record
    if buffer.strip():
        record = _parse_line(buffer, report)
        if record is not None:
            yield record


def _parse_line(line: bytes, report: ReadReport) -> dict[str, Any] | None:
    line = line.strip()
    if not line:
        return None
    try:
        record = json.loads(line)
    except (ValueError, UnicodeDecodeError):
        report.bad_lines += 1
        return None
    if not isinstance(record, dict):
        report.bad_lines += 1
        return None
    return record


def is_tag(record: dict[str, Any]) -> bool:
    return record.get("type") == "tag"


@dataclass
class FileScan:
    samples: int
    tags: int
    damaged: bool
    bad_lines: int


def scan_file(data: bytes) -> FileScan:
    """Count samples and tags without analysing them (used to validate uploads)."""
    report = ReadReport()
    samples = tags = 0
    for record in iter_records(data, report):
        if is_tag(record):
            tags += 1
        else:
            samples += 1
    return FileScan(samples=samples, tags=tags, damaged=report.damaged, bad_lines=report.bad_lines)


# --------------------------------------------------------------------------- #
# Geometry helpers
# --------------------------------------------------------------------------- #


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6_371_000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(h)))


def vertical_acceleration(acc: list[float], rot: list[float] | None) -> float:
    """Earth-frame vertical component of a device-frame acceleration.

    Uses the third row of the rotation matrix Android derives from the
    rotation-vector quaternion (SensorManager.getRotationMatrixFromVector).
    Without orientation, falls back to the magnitude, which over-states
    roughness but keeps the trip usable.
    """
    ax, ay, az = acc[0], acc[1], acc[2]
    if rot and len(rot) >= 3:
        x, y, z = rot[0], rot[1], rot[2]
        if len(rot) >= 4:
            w = rot[3]
        else:
            w = math.sqrt(max(0.0, 1.0 - x * x - y * y - z * z))
        r6 = 2 * x * z - 2 * y * w
        r7 = 2 * y * z + 2 * x * w
        r8 = 1 - 2 * x * x - 2 * y * y
        return r6 * ax + r7 * ay + r8 * az
    return math.sqrt(ax * ax + ay * ay + az * az)


def classify(roughness: float) -> str:
    if roughness >= settings.ROUGHNESS_POOR:
        return "POOR"
    if roughness >= settings.ROUGHNESS_FAIR:
        return "FAIR"
    return "GOOD"


# --------------------------------------------------------------------------- #
# Analysis
# --------------------------------------------------------------------------- #


@dataclass
class SegmentResult:
    seq: int
    start_ts: int
    length_m: float
    distance_from_start_m: float
    avg_speed: float
    sample_count: int
    roughness: float
    condition: str
    coordinates: list[list[float]]


@dataclass
class HazardResult:
    ts: int
    lat: float
    lon: float
    source: str
    kind: str
    magnitude: float | None
    speed: float | None


@dataclass
class TripAnalysis:
    samples: int = 0
    duplicates_dropped: int = 0
    tags: int = 0
    damaged: bool = False
    bad_lines: int = 0
    distance_m: float = 0.0
    avg_speed: float = 0.0
    max_speed: float = 0.0
    first_ts: int | None = None
    last_ts: int | None = None
    segments: list[SegmentResult] = field(default_factory=list)
    hazards: list[HazardResult] = field(default_factory=list)
    # Full GPS route as continuous parts of (lon, lat, ts, speed) points,
    # split wherever recording had a gap.
    track: list[list[tuple[float, float, int, float | None]]] = field(default_factory=list)

    @property
    def mapped_m(self) -> float:
        return sum(s.length_m for s in self.segments)

    @property
    def roughness_avg(self) -> float | None:
        total = self.mapped_m
        if total <= 0:
            return None
        return sum(s.roughness * s.length_m for s in self.segments) / total

    def length_by_condition(self) -> dict[str, float]:
        out = {"GOOD": 0.0, "FAIR": 0.0, "POOR": 0.0}
        for s in self.segments:
            out[s.condition] += s.length_m
        return out

    @property
    def jolt_count(self) -> int:
        return sum(1 for h in self.hazards if h.source == "detected")


class _SegmentBuilder:
    def __init__(self, start_ts: int, start_distance: float, start_fix: tuple[float, float]):
        self.start_ts = start_ts
        self.start_distance = start_distance
        self.length = 0.0
        self.values: list[float] = []
        self.speed_total = 0.0
        self.speed_count = 0
        self.coords: list[list[float]] = [[round(start_fix[1], 6), round(start_fix[0], 6)]]

    def add_sample(self, vertical: float, speed: float | None) -> None:
        self.values.append(vertical)
        if speed is not None:
            self.speed_total += speed
            self.speed_count += 1

    def add_fix(self, lat: float, lon: float, distance: float) -> None:
        self.length += distance
        self.coords.append([round(lon, 6), round(lat, 6)])

    @property
    def avg_speed(self) -> float:
        return self.speed_total / self.speed_count if self.speed_count else 0.0

    def build(self, seq: int) -> SegmentResult | None:
        if len(self.values) < MIN_SEGMENT_SAMPLES or len(self.coords) < 2:
            return None
        if self.avg_speed < settings.MIN_SEGMENT_SPEED_MPS:
            return None
        mean = sum(self.values) / len(self.values)
        rms = math.sqrt(sum((v - mean) ** 2 for v in self.values) / len(self.values))
        return SegmentResult(
            seq=seq,
            start_ts=self.start_ts,
            length_m=round(self.length, 2),
            distance_from_start_m=round(self.start_distance, 1),
            avg_speed=round(self.avg_speed, 2),
            sample_count=len(self.values),
            roughness=round(rms, 4),
            condition=classify(rms),
            coordinates=self.coords,
        )


def analyse_trip(data: bytes) -> TripAnalysis:
    result = TripAnalysis()
    report = ReadReport()

    prev_key: tuple | None = None
    last_rot: list[float] | None = None
    last_speed: float | None = None
    speed_total = 0.0
    speed_count = 0

    fix: tuple[float, float] | None = None  # last accepted (lat, lon)
    fix_time: int | None = None
    fix_key: tuple | None = None  # identity of the last raw fix seen
    rejected = 0
    distance = 0.0
    segment: _SegmentBuilder | None = None
    seq = 0

    pending_jolt: HazardResult | None = None

    def close_segment() -> None:
        nonlocal segment, seq
        if segment is not None:
            built = segment.build(seq)
            if built is not None:
                result.segments.append(built)
                seq += 1
        segment = None

    def flush_jolt() -> None:
        nonlocal pending_jolt
        if pending_jolt is not None:
            result.hazards.append(pending_jolt)
            pending_jolt = None

    for record in iter_records(data, report):
        ts = record.get("ts")
        if not isinstance(ts, (int, float)):
            continue
        ts = int(ts)
        lat, lon = record.get("lat"), record.get("lon")
        has_position = isinstance(lat, (int, float)) and isinstance(lon, (int, float)) and not (lat == 0 and lon == 0)

        if is_tag(record):
            kind = str(record.get("tag") or "OTHER").upper()
            position = (float(lat), float(lon)) if has_position else fix
            if position is not None:
                result.tags += 1
                result.hazards.append(
                    HazardResult(
                        ts=ts,
                        lat=position[0],
                        lon=position[1],
                        source="tagged",
                        kind=kind if kind in TAG_KINDS else "OTHER",
                        magnitude=None,
                        speed=last_speed,
                    )
                )
            continue

        acc = record.get("acc_d") or record.get("acc_device")
        if not (isinstance(acc, list) and len(acc) >= 3):
            continue
        key = (ts, acc[0], acc[1], acc[2])
        if key == prev_key:
            result.duplicates_dropped += 1
            continue
        prev_key = key

        result.samples += 1
        result.first_ts = ts if result.first_ts is None else min(result.first_ts, ts)
        result.last_ts = ts if result.last_ts is None else max(result.last_ts, ts)

        rot = record.get("rot")
        if isinstance(rot, list) and len(rot) >= 3:
            last_rot = rot
        speed = record.get("spd", record.get("speed_mps"))
        if isinstance(speed, (int, float)) and 0 <= speed <= MAX_IMPLIED_SPEED_MPS:
            last_speed = float(speed)
            speed_total += last_speed
            speed_count += 1
            result.max_speed = max(result.max_speed, last_speed)

        # --- GPS track and segmentation ---
        if has_position:
            fix_ts = record.get("fix_ts")
            raw_key = (lat, lon, fix_ts)
            if raw_key != fix_key:
                fix_key = raw_key
                accuracy = record.get("gps_acc", record.get("gps_accuracy"))
                accurate = not isinstance(accuracy, (int, float)) or accuracy <= MAX_FIX_ACCURACY_M
                at = int(fix_ts) if isinstance(fix_ts, (int, float)) else ts
                if accurate:
                    point = (float(lat), float(lon))
                    track_point = (round(point[1], 6), round(point[0], 6), at, last_speed)
                    if fix is None or fix_time is None:
                        fix, fix_time = point, at
                        segment = _SegmentBuilder(ts, distance, point)
                        result.track.append([track_point])
                    else:
                        step = haversine_m(fix[0], fix[1], point[0], point[1])
                        dt = at - fix_time
                        if dt > MAX_FIX_GAP_MS or dt < 0:
                            # Gap: start a fresh segment. Short, plausible gaps
                            # still count towards distance and continue the route.
                            close_segment()
                            plausible = 0 < dt <= MAX_TRACK_GAP_MS and step / (dt / 1000) <= MAX_IMPLIED_SPEED_MPS
                            if plausible:
                                distance += step
                                result.track[-1].append(track_point)
                            else:
                                result.track.append([track_point])
                            fix, fix_time, rejected = point, at, 0
                            segment = _SegmentBuilder(ts, distance, point)
                        elif dt > 0 and step / (dt / 1000) > MAX_IMPLIED_SPEED_MPS:
                            rejected += 1
                            if rejected > MAX_REJECTED_FIXES:
                                # The earlier fix was the outlier; restart from here.
                                close_segment()
                                fix, fix_time, rejected = point, at, 0
                                segment = _SegmentBuilder(ts, distance, point)
                                result.track.append([track_point])
                        elif step > 0:
                            rejected = 0
                            distance += step
                            fix, fix_time = point, at
                            result.track[-1].append(track_point)
                            if segment is None:
                                segment = _SegmentBuilder(ts, distance - step, point)
                            segment.add_fix(point[0], point[1], step)
                            if segment.length >= settings.SEGMENT_LENGTH_M:
                                close_segment()
                                segment = _SegmentBuilder(ts, distance, point)

        # --- vertical acceleration ---
        vertical = vertical_acceleration(acc, last_rot)
        if segment is not None:
            segment.add_sample(vertical, last_speed)

        moving = last_speed is not None and last_speed >= settings.MIN_SEGMENT_SPEED_MPS
        if moving and fix is not None and abs(vertical) >= settings.JOLT_THRESHOLD:
            magnitude = round(abs(vertical), 2)
            if pending_jolt is not None and ts - pending_jolt.ts <= JOLT_MERGE_MS:
                if magnitude > (pending_jolt.magnitude or 0):
                    pending_jolt.magnitude = magnitude
                    pending_jolt.lat, pending_jolt.lon = fix
                    pending_jolt.speed = last_speed
            else:
                flush_jolt()
                pending_jolt = HazardResult(
                    ts=ts,
                    lat=fix[0],
                    lon=fix[1],
                    source="detected",
                    kind="JOLT",
                    magnitude=magnitude,
                    speed=last_speed,
                )

    close_segment()
    flush_jolt()

    result.distance_m = round(distance, 1)
    result.avg_speed = speed_total / speed_count if speed_count else 0.0
    result.damaged = report.damaged
    result.bad_lines = report.bad_lines
    result.hazards.sort(key=lambda h: h.ts)
    result.track = simplify_track([part for part in result.track if part], MAX_TRACK_POINTS)
    return result


def simplify_track(parts: list[list[tuple]], max_points: int) -> list[list[tuple]]:
    """Evenly thin a multi-part route to at most ``max_points``, keeping each part's ends."""
    total = sum(len(part) for part in parts)
    if total <= max_points:
        return parts
    stride = math.ceil(total / max_points)
    thinned = []
    for part in parts:
        kept = part[::stride]
        if kept[-1] is not part[-1]:
            kept.append(part[-1])
        thinned.append(kept)
    return thinned


def read_and_analyse(path: Path) -> TripAnalysis:
    return analyse_trip(path.read_bytes())
