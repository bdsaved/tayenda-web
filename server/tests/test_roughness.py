import gzip
import json

from app.core.roughness import analyse_trip, haversine_m, scan_file, vertical_acceleration

from .conftest import make_samples, to_gzip


def test_haversine_one_degree_latitude():
    assert abs(haversine_m(0, 0, 1, 0) - 111_195) < 50


def test_vertical_acceleration_identity_and_tilted():
    assert vertical_acceleration([0.0, 0.0, 2.0], [0.0, 0.0, 0.0, 1.0]) == 2.0
    # Phone rotated 90 degrees about X (standing up): device +Y points up.
    s = 2 ** -0.5
    assert abs(vertical_acceleration([0.0, 3.0, 0.0], [s, 0.0, 0.0, s]) - 3.0) < 1e-9


def test_smooth_road_is_good_and_rough_road_is_poor():
    smooth = analyse_trip(to_gzip(make_samples(noise=0.2)))
    rough = analyse_trip(to_gzip(make_samples(noise=2.5)))

    assert smooth.segments and rough.segments
    assert {s.condition for s in smooth.segments} == {"GOOD"}
    assert {s.condition for s in rough.segments} == {"POOR"}
    # 60 s at 10 m/s, in ~50 m segments.
    assert 540 <= smooth.distance_m <= 600
    assert 10 <= len(smooth.segments) <= 12


def test_duplicate_rows_are_dropped():
    analysis = analyse_trip(to_gzip(make_samples(seconds=10, duplicate=True)))
    assert analysis.samples == 500
    assert analysis.duplicates_dropped == 500


def test_jolt_detected_and_tag_recorded():
    records = make_samples(seconds=30, jolt_at_s=12.0)
    records.insert(100, {"type": "tag", "ts": records[100]["ts"], "lat": -15.786, "lon": 35.006, "tag": "flood"})
    analysis = analyse_trip(to_gzip(records))

    jolts = [h for h in analysis.hazards if h.source == "detected"]
    tags = [h for h in analysis.hazards if h.source == "tagged"]
    assert len(jolts) == 1 and jolts[0].magnitude >= 10
    assert len(tags) == 1 and tags[0].kind == "FLOOD"
    assert analysis.samples == 30 * 50  # tag lines are not samples


def test_slow_movement_produces_no_segments():
    analysis = analyse_trip(to_gzip(make_samples(speed=1.0)))
    assert analysis.samples > 0
    assert analysis.segments == []


def test_gps_outlier_is_ignored():
    records = make_samples(seconds=20)
    for r in records[500:550]:  # one fix 5 km away
        r["lat"] = -15.74
    analysis = analyse_trip(to_gzip(records))
    assert analysis.distance_m < 250


def test_truncated_file_is_salvaged():
    data = to_gzip(make_samples(seconds=20))
    analysis = analyse_trip(data[: len(data) // 2])
    assert analysis.damaged
    assert 100 < analysis.samples < 1000


def test_corrupt_member_followed_by_good_member_is_salvaged():
    """The old app appended a new gzip member after an unterminated one on resume."""
    first = make_samples(seconds=10)
    second = make_samples(seconds=10, seed=2)
    for r in second:
        r["ts"] += 60_000
    broken = to_gzip(first)[:-200]  # lost tail + trailer
    analysis = analyse_trip(broken + to_gzip(second))
    assert analysis.damaged
    assert analysis.samples >= len(second)


def test_scan_counts_samples_and_tags():
    records = make_samples(seconds=2) + [{"type": "tag", "ts": 1, "lat": 1.0, "lon": 1.0, "tag": "POTHOLE"}]
    scan = scan_file(gzip.compress("\n".join(json.dumps(r) for r in records).encode()))
    assert (scan.samples, scan.tags, scan.damaged) == (100, 1, False)


def test_route_continues_across_short_gps_gap():
    records = make_samples(seconds=60)
    # GPS paused for 30 s (old app's stationary back-off): drop fixes in the middle.
    gap = [r for r in records if not (1_780_000_015_000 <= r["fix_ts"] < 1_780_000_045_000)]
    analysis = analyse_trip(to_gzip(gap))
    assert len(analysis.track) == 1
    assert 540 <= analysis.distance_m <= 600


def test_impossible_speeds_are_ignored():
    records = make_samples(seconds=10)
    for r in records:
        r["spd"] = 211.0
    assert analyse_trip(to_gzip(records)).max_speed == 0.0
