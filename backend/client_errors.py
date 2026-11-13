"""Crash reports from the web app (no third-party service).

POST /api/client-errors  {message, stack, page, version, ua}  -> 204. Rate limited per IP, size-capped.
Stored in db.client_errors; a TTL index removes them after CLIENT_ERROR_TTL_DAYS (14). No personal data is kept:
the IP is used only for the in-memory rate limit, the page is stored without query string or hash.
GET /api/client-errors?token=ADMIN_TOKEN -> the last 100 (404 when ADMIN_TOKEN is not set)."""
import hmac
import json
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response

from db import db
from security import RateLimiter

router = APIRouter()
MAX_BODY = 8 * 1024
LIMITS = {"message": 500, "stack": 4096, "page": 300, "version": 40, "ua": 300, "kind": 20}
TTL_DAYS = int(os.environ.get("CLIENT_ERROR_TTL_DAYS", "14"))
error_limiter = RateLimiter(int(os.environ.get("CLIENT_ERROR_RATE", "20")), 3600)


def _clean(data: dict) -> dict:
    out = {}
    for k, n in LIMITS.items():
        v = data.get(k)
        out[k] = v[:n] if isinstance(v, str) else ""
    out["page"] = out["page"].split("?", 1)[0].split("#", 1)[0]
    return out


async def ensure_client_error_indexes():
    await db.client_errors.create_index("created_at", expireAfterSeconds=TTL_DAYS * 86400)


@router.post("/api/client-errors")
async def report_client_error(request: Request):
    ip = request.client.host if request.client else "?"
    if not error_limiter.allow(ip):
        return JSONResponse({"detail": "Çok fazla hata raporu", "code": "rate_limited"}, status_code=429)
    declared = request.headers.get("content-length", "")
    if declared.isdigit() and int(declared) > MAX_BODY:
        return JSONResponse({"detail": "Rapor çok büyük", "code": "too_large"}, status_code=413)
    raw = await request.body()
    if len(raw) > MAX_BODY:
        return JSONResponse({"detail": "Rapor çok büyük", "code": "too_large"}, status_code=413)
    try:
        data = json.loads(raw.decode("utf-8") or "{}")
    except Exception:
        data = None
    if not isinstance(data, dict) or not isinstance(data.get("message"), str) or not data["message"].strip():
        return JSONResponse({"detail": "Geçersiz rapor", "code": "bad_request"}, status_code=400)
    doc = _clean(data)
    doc["created_at"] = datetime.now(timezone.utc)
    await db.client_errors.insert_one(doc)
    return Response(status_code=204)


@router.get("/api/client-errors")
async def list_client_errors(request: Request):
    admin = os.environ.get("ADMIN_TOKEN", "")
    if not admin:
        return JSONResponse({"detail": "Not found", "code": "not_found"}, status_code=404)
    if not hmac.compare_digest(request.query_params.get("token", ""), admin):
        return JSONResponse({"detail": "Yetkisiz", "code": "forbidden"}, status_code=403)
    docs = await db.client_errors.find({}, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    for d in docs:
        if isinstance(d.get("created_at"), datetime):
            d["created_at"] = d["created_at"].isoformat()
    return {"errors": docs}
