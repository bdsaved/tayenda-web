"""End-to-end smoke test for the Tayenda API (standard library only).

Exercises the real device -> manifest -> raw gzip upload -> processing flow
plus operator login and trip listing, so you can confirm a deployment is wired
correctly.

Usage (from web/server/):

    # health only (safe against any environment)
    python -m scripts.smoke_test --base-url https://tayenda.renai-labs.com

    # full write flow against a LOCAL server (writes a test trip)
    python -m scripts.smoke_test --base-url http://localhost:8000 --full \
        --username admin --password "$OPERATOR_PASSWORD"

Notes:
  - --full writes a device + trip. Run it against a local/staging server, not
    production, unless you intend to leave test data behind.
  - The upload sends sha256 of the gzip bytes, which the backend verifies.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
import time
import urllib.error
import urllib.request
import uuid

DEFAULT_BASE_URL = os.getenv("TAYENDA_API_URL", "http://localhost:8000")


def _request(method: str, url: str, *, body=None, headers=None):
    data = None
    hdrs = dict(headers or {})
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        hdrs.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = resp.read().decode("utf-8")
            return resp.status, json.loads(payload) if payload else {}
    except urllib.error.HTTPError as exc:
        payload = exc.read().decode("utf-8")
        try:
            return exc.code, json.loads(payload)
        except json.JSONDecodeError:
            return exc.code, {"detail": payload}


def _multipart(url: str, *, fields: dict, file_field: str, filename: str, file_bytes: bytes, headers=None):
    boundary = uuid.uuid4().hex
    crlf = "\r\n"
    parts = []
    for name, value in fields.items():
        parts.append(
            f'--{boundary}{crlf}Content-Disposition: form-data; name="{name}"{crlf}{crlf}{value}{crlf}'.encode()
        )
    parts.append(
        f'--{boundary}{crlf}Content-Disposition: form-data; name="{file_field}"; filename="{filename}"{crlf}'
        f"Content-Type: application/gzip{crlf}{crlf}".encode()
        + file_bytes
        + crlf.encode()
    )
    parts.append(f"--{boundary}--{crlf}".encode())
    req = urllib.request.Request(url, data=b"".join(parts), method="POST", headers={
        **(headers or {}), "Content-Type": f"multipart/form-data; boundary={boundary}",
    })
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as exc:
        return exc.code, {"detail": exc.read().decode("utf-8")}


def check(label: str, ok: bool, detail: str = "") -> bool:
    mark = "PASS" if ok else "FAIL"
    print(f"[{mark}] {label}" + (f" -> {detail}" if detail else ""))
    return ok


def main() -> int:
    parser = argparse.ArgumentParser(description="Tayenda API smoke test")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--full", action="store_true", help="run the write flow (device + trip)")
    parser.add_argument("--username", default=os.getenv("OPERATOR_USERNAME", "admin"))
    parser.add_argument("--password", default=os.getenv("OPERATOR_PASSWORD"))
    args = parser.parse_args()

    base = args.base_url.rstrip("/")
    api = f"{base}/api/v1"
    print(f"Target: {base}\n")

    failures = 0

    status, body = _request("GET", f"{api}/health")
    if not check("health", status == 200 and body.get("status") == "healthy", f"{status} {body}"):
        failures += 1

    if not args.full:
        print("\n(health-only run; pass --full for the write flow)")
        return 1 if failures else 0

    # --- operator login ---
    status, body = _request(
        "POST", f"{api}/auth/login", body={"username": args.username, "password": args.password}
    )
    token = body.get("access_token")
    if not check("operator login", status == 200 and bool(token), f"{status}"):
        failures += 1
        print("\nCannot continue without a token.")
        return 1
    auth = {"Authorization": f"Bearer {token}"}

    # --- device registration ---
    device_id = f"smoke-{uuid.uuid4().hex[:16]}"
    status, body = _request(
        "POST",
        f"{api}/devices/register",
        body={
            "hashed_device_id": device_id,
            "model": "Smoke Test Device",
            "os_version": "Test OS",
            "app_version": "smoke-1.0",
        },
    )
    api_key = body.get("api_key")
    if not check("device register", status == 200 and bool(api_key), f"{status}"):
        failures += 1
        return 1
    dev_headers = {"x-api-key": api_key}

    # --- manifest ---
    trip_id = f"smoke-trip-{uuid.uuid4()}"
    now_ms = int(time.time() * 1000)
    status, body = _request(
        "POST",
        f"{api}/trips/manifest",
        body={
            "trip_id": trip_id,
            "version": "1.0",
            "device_id": device_id,
            "mount_type": "RIGID",
            "vehicle_type": "SUV",
            "road_surface": "GRAVEL",
            "sampling_profile": "BALANCED",
            "start_time": now_ms,
            "end_time": None,
            "total_samples": 0,
            "total_distance": 0.0,
            "avg_speed": 0.0,
            "mount_quality": 0.05,
            "quality_flags": {"paused": 0, "low_gps": 0, "low_speed": 0, "stationary": 0},
        },
        headers=dev_headers,
    )
    if not check("trip manifest", status == 200 and body.get("status") == "accepted", f"{status} {body}"):
        failures += 1

    # --- raw trip upload (what the Android app does) ---
    lon_step = 10.0 / 107_000  # ~10 m per second due east
    samples = []
    for i in range(30 * 50):  # 30 s at 50 Hz, 10 m/s
        second = i // 50
        samples.append({
            "ts": now_ms + i * 20,
            "lat": -15.7861,
            "lon": round(35.0058 + second * lon_step, 7),
            "spd": 10.0,
            "gps_acc": 4.0,
            "fix_ts": now_ms + second * 1000,
            "acc_d": [0.0, 0.0, 0.4 if i % 2 else -0.4],
            "rot": [0.0, 0.0, 0.0, 1.0, -1.0],
            "flags": 0,
        })
    payload = gzip.compress("".join(json.dumps(s) + "\n" for s in samples).encode("utf-8"))
    status, body = _multipart(
        f"{api}/trips/{trip_id}/gzip",
        fields={"total_samples": str(len(samples)), "sha256": hashlib.sha256(payload).hexdigest()},
        file_field="file",
        filename="trip.ndjson.gz",
        file_bytes=payload,
        headers=dev_headers,
    )
    if not check("raw upload", status == 200 and body.get("samples_received") == len(samples), f"{status} {body}"):
        failures += 1

    # --- processed into road segments ---
    status, body = _request("GET", f"{api}/trips/{trip_id}/upload-status", headers=dev_headers)
    if not check("trip processed", status == 200 and body.get("status") == "UPLOADED", f"{status} {body}"):
        failures += 1

    # --- operator can see the trip ---
    status, body = _request("GET", f"{api}/trips?q={trip_id}", headers=auth)
    found = status == 200 and any(t.get("trip_id") == trip_id for t in body.get("items", []))
    if not check("trip visible to operator", found, f"{status}"):
        failures += 1

    print(f"\n{'ALL PASSED' if not failures else f'{failures} FAILURE(S)'}  (test trip: {trip_id})")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
