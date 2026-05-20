#!/usr/bin/env python3
"""
Pixel Art Site end-to-end smoke test.

What this script does:
1) Ensures backend is running (starts uvicorn if needed)
2) Register + login
3) Extract palette colors from generated test images
4) Create palette
5) Create project with uploaded source image
6) Preprocess preview
7) Single render
8) Batch render
9) Fetch result detail
10) Export Excel and verify XLSX signature

Usage:
  python scripts/e2e_smoke_test.py

Optional env:
  PIXEL_API_URL=http://127.0.0.1:8000
"""

from __future__ import annotations

import json
import os
import random
import string
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


API_BASE = os.environ.get("PIXEL_API_URL", "http://127.0.0.1:8000").rstrip("/")
HEALTH_PATH = "/api/health"


class SmokeTestError(RuntimeError):
    pass


@dataclass
class StepResult:
    name: str
    ok: bool
    detail: str = ""


def log(msg: str) -> None:
    print(msg, flush=True)


def _request(
    method: str,
    path: str,
    body: bytes | None = None,
    headers: dict[str, str] | None = None,
    timeout: int = 20,
) -> tuple[int, bytes, dict[str, str]]:
    url = f"{API_BASE}{path}"
    req = Request(url=url, method=method, data=body, headers=headers or {})
    with urlopen(req, timeout=timeout) as resp:
        status = resp.getcode()
        data = resp.read()
        resp_headers = {k.lower(): v for k, v in resp.headers.items()}
        return status, data, resp_headers


def request_json(
    method: str,
    path: str,
    payload: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    timeout: int = 20,
) -> tuple[int, dict[str, Any], dict[str, str]]:
    hdrs = {"Content-Type": "application/json"}
    if headers:
        hdrs.update(headers)
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    status, data, resp_headers = _request(method, path, body=body, headers=hdrs, timeout=timeout)
    parsed = json.loads(data.decode("utf-8")) if data else {}
    return status, parsed, resp_headers


def request_form(
    path: str, form: dict[str, str], headers: dict[str, str] | None = None
) -> tuple[int, dict[str, Any], dict[str, str]]:
    body = urlencode(form).encode("utf-8")
    hdrs = {"Content-Type": "application/x-www-form-urlencoded"}
    if headers:
        hdrs.update(headers)
    status, data, resp_headers = _request("POST", path, body=body, headers=hdrs)
    parsed = json.loads(data.decode("utf-8")) if data else {}
    return status, parsed, resp_headers


def request_multipart(
    method: str,
    path: str,
    fields: dict[str, str] | None = None,
    files: list[tuple[str, str, bytes, str]] | None = None,
    headers: dict[str, str] | None = None,
    timeout: int = 40,
) -> tuple[int, bytes, dict[str, str]]:
    boundary = "----PixelSmokeBoundary" + "".join(
        random.choice(string.ascii_letters + string.digits) for _ in range(12)
    )
    lines: list[bytes] = []

    for key, value in (fields or {}).items():
        lines.append(f"--{boundary}".encode("utf-8"))
        lines.append(f'Content-Disposition: form-data; name="{key}"'.encode("utf-8"))
        lines.append(b"")
        lines.append(str(value).encode("utf-8"))

    for field_name, filename, content, content_type in (files or []):
        lines.append(f"--{boundary}".encode("utf-8"))
        lines.append(
            f'Content-Disposition: form-data; name="{field_name}"; filename="{filename}"'.encode(
                "utf-8"
            )
        )
        lines.append(f"Content-Type: {content_type}".encode("utf-8"))
        lines.append(b"")
        lines.append(content)

    lines.append(f"--{boundary}--".encode("utf-8"))
    lines.append(b"")

    body = b"\r\n".join(lines)
    hdrs = {"Content-Type": f"multipart/form-data; boundary={boundary}"}
    if headers:
        hdrs.update(headers)
    return _request(method, path, body=body, headers=hdrs, timeout=timeout)


def make_ppm_bytes(width: int, height: int, seed: int = 0) -> bytes:
    # PPM (P6) is trivial to generate and readable by Pillow backend side.
    rnd = random.Random(seed)
    header = f"P6\n{width} {height}\n255\n".encode("ascii")
    pixels = bytearray()
    for y in range(height):
        for x in range(width):
            r = (x * 7 + y * 3 + rnd.randint(0, 50)) % 256
            g = (x * 5 + y * 11 + rnd.randint(0, 50)) % 256
            b = (x * 13 + y * 2 + rnd.randint(0, 50)) % 256
            pixels.extend((r, g, b))
    return header + bytes(pixels)


def is_backend_up() -> bool:
    try:
        status, body, _ = _request("GET", HEALTH_PATH, timeout=3)
        if status != 200:
            return False
        data = json.loads(body.decode("utf-8"))
        return data.get("status") == "ok"
    except Exception:
        return False


def start_backend_if_needed() -> tuple[subprocess.Popen[str] | None, bool]:
    if is_backend_up():
        log("Backend already running.")
        return None, False

    backend_dir = Path(__file__).resolve().parent.parent / "backend"
    cmd = [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"]
    log("Backend not running, starting uvicorn...")
    proc = subprocess.Popen(
        cmd,
        cwd=str(backend_dir),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    deadline = time.time() + 30
    while time.time() < deadline:
        if proc.poll() is not None:
            out = proc.stdout.read() if proc.stdout else ""
            raise SmokeTestError(f"Backend failed to start.\n{out}")
        if is_backend_up():
            log("Backend started.")
            return proc, True
        time.sleep(1)

    raise SmokeTestError("Backend start timeout (30s).")


def run_smoke_test() -> list[StepResult]:
    results: list[StepResult] = []
    suffix = "".join(random.choice(string.ascii_lowercase + string.digits) for _ in range(8))
    username = f"smoke_{suffix}"
    password = "smoke123"

    def add_step(name: str, ok: bool, detail: str = "") -> None:
        icon = "PASS" if ok else "FAIL"
        log(f"[{icon}] {name}{' - ' + detail if detail else ''}")
        results.append(StepResult(name=name, ok=ok, detail=detail))
        if not ok:
            raise SmokeTestError(f"{name} failed: {detail}")

    # 1. Health
    status, body, _ = _request("GET", HEALTH_PATH)
    data = json.loads(body.decode("utf-8"))
    add_step("Health check", status == 200 and data.get("status") == "ok", str(data))

    # 2. Register
    try:
        status, reg_data, _ = request_json(
            "POST",
            "/api/auth/register",
            {"username": username, "password": password},
        )
        add_step("Register", status == 200 and reg_data.get("username") == username)
    except HTTPError as e:
        add_step("Register", False, f"HTTP {e.code}")

    # 3. Login
    status, login_data, _ = request_form("/api/auth/login", {"username": username, "password": password})
    token = login_data.get("access_token")
    add_step("Login", status == 200 and isinstance(token, str) and len(token) > 20)
    auth_headers = {"Authorization": f"Bearer {token}"}

    # 4. Extract palette candidates
    palette_img1 = make_ppm_bytes(24, 24, seed=11)
    palette_img2 = make_ppm_bytes(24, 24, seed=29)
    status, raw, _ = request_multipart(
        "POST",
        "/api/palettes/extract",
        files=[
            ("files", "palette_a.ppm", palette_img1, "image/x-portable-pixmap"),
            ("files", "palette_b.ppm", palette_img2, "image/x-portable-pixmap"),
        ],
        headers=auth_headers,
    )
    extract_data = json.loads(raw.decode("utf-8"))
    candidates = extract_data.get("candidates", [])
    add_step("Palette extract", status == 200 and len(candidates) > 0, f"{len(candidates)} candidates")

    # 5. Create palette
    selected = candidates[: min(8, len(candidates))]
    colors = [
        {"sort": i + 1, "label": str(i + 1), "r": c["r"], "g": c["g"], "b": c["b"]}
        for i, c in enumerate(selected)
    ]
    status, palette_data, _ = request_json(
        "POST", "/api/palettes", {"name": "Smoke Palette", "colors": colors}, headers=auth_headers
    )
    palette_id = palette_data.get("id")
    add_step("Create palette", status == 200 and isinstance(palette_id, int), f"id={palette_id}")

    # 6. Create project
    photo = make_ppm_bytes(64, 64, seed=57)
    fields = {
        "palette_id": str(palette_id),
        "name": "Smoke Project",
        "canvas_w": "32",
        "canvas_h": "32",
        "crop_json": json.dumps({"x": 0.05, "y": 0.05, "w": 0.9, "h": 0.9}),
        "preprocess_json": json.dumps(
            {"enabled": True, "posterize_levels": 6, "blur_radius": 1, "edge_strength": 0.25}
        ),
    }
    status, raw, _ = request_multipart(
        "POST",
        "/api/projects",
        fields=fields,
        files=[("file", "photo.ppm", photo, "image/x-portable-pixmap")],
        headers=auth_headers,
    )
    project_data = json.loads(raw.decode("utf-8"))
    project_id = project_data.get("id")
    add_step("Create project", status == 200 and isinstance(project_id, int), f"id={project_id}")

    # 7. Preprocess preview
    status, preview_data, _ = request_json(
        "POST",
        f"/api/projects/{project_id}/preprocess",
        {"enabled": True, "posterize_levels": 6, "blur_radius": 2, "edge_strength": 0.35},
        headers=auth_headers,
    )
    add_step("Preprocess preview", status == 200 and "preview_url" in preview_data)

    # 8. Single render
    render_payload = {
        "params": {
            "color_space": "lab",
            "render_mode": "nearest",
            "dither": "none",
            "saturation": 1.0,
            "gamma": 1.0,
            "contrast": 1.0,
            "smart_cutout": False,
            "preprocess": {"enabled": True, "posterize_levels": 6, "blur_radius": 2, "edge_strength": 0.2},
        }
    }
    status, render_data, _ = request_json(
        "POST", f"/api/projects/{project_id}/render", render_payload, headers=auth_headers
    )
    result_id = render_data.get("id")
    add_step("Single render", status == 200 and isinstance(result_id, int), f"result={result_id}")

    # 9. Batch render
    batch_payload = {
        "base_params": {
            "color_space": "lab",
            "render_mode": "nearest",
            "dither": "none",
            "saturation": 1.0,
            "gamma": 1.0,
            "contrast": 1.0,
            "smart_cutout": False,
            "preprocess": {"enabled": True, "posterize_levels": 6, "blur_radius": 1, "edge_strength": 0.2},
        },
        "param_grid": {
            "dither": {"values": ["none", "ordered-bayer"]},
            "gamma": {"values": [0.9, 1.1]},
            "saturation": {"values": [1.0]},
        },
    }
    status, batch_data, _ = request_json(
        "POST", f"/api/projects/{project_id}/batch", batch_payload, headers=auth_headers
    )
    batch_results = batch_data.get("results", [])
    add_step("Batch render", status == 200 and len(batch_results) > 0, f"{len(batch_results)} outputs")

    # 10. Result detail
    status, detail_data, _ = request_json("GET", f"/api/results/{result_id}", headers=auth_headers)
    add_step("Result detail", status == 200 and detail_data.get("id") == result_id)

    # 11. Export excel
    status, excel_bytes, excel_headers = _request(
        "POST", f"/api/results/{result_id}/export/excel", headers=auth_headers, timeout=40
    )
    content_type = excel_headers.get("content-type", "")
    is_zip = excel_bytes.startswith(b"PK")
    add_step(
        "Export Excel",
        status == 200 and is_zip and "spreadsheetml" in content_type,
        f"{len(excel_bytes)} bytes",
    )

    return results


def main() -> int:
    log("=== Pixel Art Site E2E Smoke Test ===")
    backend_proc: subprocess.Popen[str] | None = None
    started_here = False
    try:
        backend_proc, started_here = start_backend_if_needed()
        results = run_smoke_test()
        passed = sum(1 for r in results if r.ok)
        log(f"\nDone: {passed}/{len(results)} steps passed.")
        return 0
    except (SmokeTestError, HTTPError, URLError, json.JSONDecodeError) as exc:
        log(f"\nSmoke test FAILED: {exc}")
        return 1
    finally:
        if backend_proc and started_here and backend_proc.poll() is None:
            log("Stopping backend started by this script...")
            backend_proc.terminate()
            try:
                backend_proc.wait(timeout=8)
            except subprocess.TimeoutExpired:
                backend_proc.kill()


if __name__ == "__main__":
    raise SystemExit(main())
