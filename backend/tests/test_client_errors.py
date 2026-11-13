# Crash reports (POST/GET /api/client-errors) and the health probe. Runs against a live backend:
# NEXORA_API_URL=http://host:port NEXORA_ADMIN_TOKEN=<the backend's ADMIN_TOKEN> python3 -m pytest -q tests/test_client_errors.py
# (the admin read tests are skipped when NEXORA_ADMIN_TOKEN is not given; the rate limit test needs CLIENT_ERROR_RATE <= 40).
import os
import uuid

import pytest
import requests

BASE_URL = (os.environ.get("NEXORA_API_URL") or os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = os.environ.get("NEXORA_ADMIN_TOKEN", "")
needs_admin = pytest.mark.skipif(not ADMIN, reason="NEXORA_ADMIN_TOKEN not set")


def test_health():
    r = requests.get(f"{API}/health", timeout=10)
    assert r.status_code == 200 and r.json()["ok"] is True


def test_rejects_bad_reports():
    assert requests.post(f"{API}/client-errors", json={"stack": "x"}, timeout=10).status_code == 400
    assert requests.post(f"{API}/client-errors", data="not json", timeout=10).status_code == 400
    big = {"message": "x", "stack": "y" * 20000}
    assert requests.post(f"{API}/client-errors", json=big, timeout=10).status_code == 413


def test_admin_read_needs_token():
    r = requests.get(f"{API}/client-errors", params={"token": "wrong"}, timeout=10)
    assert r.status_code in (403, 404)
    assert requests.get(f"{API}/client-errors", timeout=10).status_code in (403, 404)


@needs_admin
def test_report_is_stored_capped_and_listed():
    tag = f"TEST_err_{uuid.uuid4().hex[:8]}"
    r = requests.post(f"{API}/client-errors", json={
        "message": tag, "stack": "s" * 6000, "page": "/room/ABC123?token=secret#x",
        "version": "1.6.0", "ua": "pytest", "kind": "error", "nickname": "should-not-be-stored",
    }, timeout=10)
    assert r.status_code == 204, r.text
    r = requests.get(f"{API}/client-errors", params={"token": ADMIN}, timeout=10)
    assert r.status_code == 200
    errs = r.json()["errors"]
    assert len(errs) <= 100
    mine = [e for e in errs if e["message"] == tag]
    assert len(mine) == 1
    e = mine[0]
    assert len(e["stack"]) == 4096
    assert e["page"] == "/room/ABC123"
    assert e["version"] == "1.6.0" and e["ua"] == "pytest"
    assert "nickname" not in e and "ip" not in e and "created_at" in e


def test_rate_limited_per_ip():
    codes = [requests.post(f"{API}/client-errors", json={"message": "TEST_flood"}, timeout=10).status_code for _ in range(45)]
    assert 429 in codes
    assert all(c in (204, 429) for c in codes)
