import hashlib
import uuid

from .conftest import make_samples, manifest, to_gzip


def upload(client, device, trip_id: str, data: bytes, sha256: str | None = None):
    response = client.post("/api/v1/trips/manifest", json=manifest(trip_id, device["id"]), headers=device["headers"])
    assert response.status_code == 200, response.text
    form = {"total_samples": "0"}
    if sha256 is not None:
        form["sha256"] = sha256
    return client.post(
        f"/api/v1/trips/{trip_id}/gzip",
        files={"file": ("trip.ndjson.gz", data, "application/gzip")},
        data=form,
        headers=device["headers"],
    )


def test_register_rotates_key_unless_current_key_is_presented(client):
    body = {"hashed_device_id": "rotation-device-01", "model": "A", "os_version": "B", "app_version": "1"}
    first = client.post("/api/v1/devices/register", json=body).json()
    assert first["status"] == "registered"

    same = client.post("/api/v1/devices/register", json=body, headers={"x-api-key": first["api_key"]}).json()
    assert same == {**first, "status": "existing"}

    stolen = client.post("/api/v1/devices/register", json=body).json()
    assert stolen["status"] == "rotated" and stolen["api_key"] != first["api_key"]
    old_key = client.get("/api/v1/trips/x/upload-status", headers={"x-api-key": first["api_key"]})
    assert old_key.status_code == 401


def test_full_mobile_upload_is_processed(client, device, operator_headers):
    trip_id = f"trip-{uuid.uuid4()}"
    records = make_samples(seconds=60, noise=2.5, jolt_at_s=30, duplicate=True)
    records.insert(10, {"type": "tag", "ts": records[10]["ts"], "lat": -15.786, "lon": 35.0051, "tag": "POTHOLE"})
    data = to_gzip(records)

    response = upload(client, device, trip_id, data, sha256=hashlib.sha256(data).hexdigest())
    assert response.status_code == 200, response.text
    assert response.json()["samples_received"] == 2 * 60 * 50

    # BackgroundTasks run before TestClient returns, so processing is done.
    status = client.get(f"/api/v1/trips/{trip_id}/upload-status", headers=device["headers"]).json()
    assert status["status"] == "UPLOADED"

    trip = client.get(f"/api/v1/trips/{trip_id}", headers=operator_headers).json()["trip"]
    assert trip["total_samples_received"] == 60 * 50
    assert 540 <= trip["total_distance"] <= 600
    assert trip["poor_m"] > 0 and trip["roughness_avg"] > 1.6
    assert trip["hazard_count"] >= 1 and trip["tag_count"] == 1
    assert trip["raw_available"] is True
    assert "duplicate" in (trip["notes"] or "")

    segments = client.get(f"/api/v1/trips/{trip_id}/segments", headers=operator_headers).json()
    assert segments["type"] == "FeatureCollection" and len(segments["features"]) >= 10
    assert segments["features"][0]["geometry"]["type"] == "LineString"

    hazards = client.get(f"/api/v1/trips/{trip_id}/hazards", headers=operator_headers).json()["items"]
    assert {h["source"] for h in hazards} == {"detected", "tagged"}

    clusters = client.get("/api/v1/analytics/hazards", headers=operator_headers).json()["items"]
    assert any(trip_id in c["trip_ids"] for c in clusters)

    summary = client.get("/api/v1/analytics/summary", headers=operator_headers).json()
    assert summary["mapped_km"] > 0 and summary["hazards_tagged"] >= 1

    raw = client.get(f"/api/v1/trips/{trip_id}/download", headers=operator_headers)
    assert raw.status_code == 200 and raw.content == data


def test_checksum_mismatch_is_rejected(client, device):
    response = upload(client, device, f"trip-{uuid.uuid4()}", to_gzip(make_samples(seconds=2)), sha256="0" * 64)
    assert response.status_code == 422
    assert "Checksum" in response.json()["detail"]


def test_unreadable_file_is_rejected(client, device):
    response = upload(client, device, f"trip-{uuid.uuid4()}", b"\x1f\x8b\x08garbage")
    assert response.status_code == 422


def test_upload_status_requires_owner(client, device):
    trip_id = f"trip-{uuid.uuid4()}"
    upload(client, device, trip_id, to_gzip(make_samples(seconds=2)))
    assert client.get(f"/api/v1/trips/{trip_id}/upload-status").status_code == 401

    other = client.post(
        "/api/v1/devices/register",
        json={"hashed_device_id": f"other-{uuid.uuid4().hex}", "model": "X", "os_version": "Y", "app_version": "1"},
    ).json()
    response = client.get(f"/api/v1/trips/{trip_id}/upload-status", headers={"x-api-key": other["api_key"]})
    assert response.status_code == 404


def test_operator_endpoints_require_login(client, device):
    trip_id = f"trip-{uuid.uuid4()}"
    upload(client, device, trip_id, to_gzip(make_samples(seconds=2)))
    for path in (f"/api/v1/trips/{trip_id}/download", "/api/v1/trips", "/api/v1/export/trips.csv"):
        assert client.get(path).status_code == 401, path


def test_trip_list_pagination_and_filters(client, device, operator_headers):
    for _ in range(3):
        upload(client, device, f"page-{uuid.uuid4()}", to_gzip(make_samples(seconds=2)))
    page = client.get(
        "/api/v1/trips", params={"q": "page-", "limit": 2, "offset": 0}, headers=operator_headers
    ).json()
    assert page["total"] >= 3 and len(page["items"]) == 2


def test_web_upload_conflict_reprocess_and_delete(client, operator_headers):
    form = {
        "trip_id": f"web-{uuid.uuid4()}",
        "device_id": "web-device",
        "device_model": "Upload",
        "collector_name": "Field team",
        "mount_type": "RIGID",
        "vehicle_type": "CAR",
        "road_surface": "PAVED",
        "sampling_profile": "BALANCED",
        "start_time": "1780000000000",
        "notes": "Operator note",
    }
    data = to_gzip(make_samples(seconds=30))
    files = {"sample_file": ("trip.ndjson.gz", data, "application/gzip")}
    created = client.post("/api/v1/web/trips/upload", data=form, files=files, headers=operator_headers)
    assert created.status_code == 200, created.text

    trip = client.get(f"/api/v1/trips/{form['trip_id']}", headers=operator_headers).json()["trip"]
    assert trip["status"] == "UPLOADED" and trip["notes"] == "Operator note"

    again = client.post("/api/v1/web/trips/upload", data=form, files=files, headers=operator_headers)
    assert again.status_code == 409

    assert client.post(f"/api/v1/trips/{form['trip_id']}/reprocess", headers=operator_headers).status_code == 200
    assert client.delete(f"/api/v1/trips/{form['trip_id']}", headers=operator_headers).status_code == 204
    assert client.get(f"/api/v1/trips/{form['trip_id']}", headers=operator_headers).status_code == 404


def test_exports(client, operator_headers):
    trips_csv = client.get("/api/v1/export/trips.csv", headers=operator_headers)
    assert trips_csv.status_code == 200 and trips_csv.text.startswith("trip_id,")
    geojson = client.get("/api/v1/export/segments.geojson", headers=operator_headers)
    assert geojson.status_code == 200 and geojson.json()["type"] == "FeatureCollection"
    assert client.get("/api/v1/export/hazards.csv", headers=operator_headers).status_code == 200
    assert client.get("/api/v1/devices", headers=operator_headers).json()["items"]


def test_trip_track_covers_whole_trip_including_slow_parts(client, device, operator_headers):
    trip_id = f"track-{uuid.uuid4()}"
    moving = make_samples(seconds=30, speed=10.0)
    crawling = make_samples(seconds=30, speed=1.0, seed=3)
    # Continue from where the fast part ended, after a 10 minute recording gap.
    last = moving[-1]
    for r in crawling:
        r["ts"] += 630_000
        r["fix_ts"] += 630_000
        r["lon"] = round(r["lon"] - 35.005 + last["lon"], 7)
    response = upload(client, device, trip_id, to_gzip(moving + crawling))
    assert response.status_code == 200, response.text

    track = client.get(f"/api/v1/trips/{trip_id}/track", headers=operator_headers).json()
    assert track["geometry"]["type"] == "MultiLineString"
    assert len(track["geometry"]["coordinates"]) == 2  # split at the recording gap
    props = track["properties"]
    assert props["start_ts"] == moving[0]["fix_ts"]
    assert props["end_ts"] == crawling[-1]["fix_ts"]
    assert len(props["timestamps"][0]) == len(track["geometry"]["coordinates"][0])
    assert props["start"] == track["geometry"]["coordinates"][0][0]

    overview = client.get("/api/v1/analytics/tracks", headers=operator_headers).json()
    feature = next(f for f in overview["features"] if f["properties"]["trip_id"] == trip_id)
    assert "timestamps" not in feature["properties"]
