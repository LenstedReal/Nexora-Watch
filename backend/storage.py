import asyncio
import math
import os
import re
import shutil
import time
import uuid
from pathlib import Path
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse, Response, StreamingResponse

import rooms as R
from config import (MAX_UPLOAD_BYTES, MEDIA_DIR, OCI_ACCESS_KEY, OCI_BUCKET, OCI_MONTHLY_REQUEST_LIMIT, OCI_REGION,
                    OCI_S3_ENDPOINT, OCI_SECRET_KEY, PARTICIPANT_QUOTA_BYTES, STORAGE_DRIVER, STORAGE_QUOTA_BYTES,
                    STORAGE_WARN_RATIO)
from db import db
from hub import hub
from models import Media
from security import ApiError, sign, verify_sig

router = APIRouter(prefix="/api")
EXT_MIME = {"mp4": "video/mp4", "m4v": "video/x-m4v", "webm": "video/webm", "mov": "video/quicktime"}
MIN_PART = 8 * 1024 * 1024
URL_TTL = 3600


def month_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


async def count_requests(n: int = 1):
    await db.usage.update_one({"month": month_key()}, {"$inc": {"requests": n}}, upsert=True)


async def month_requests() -> int:
    doc = await db.usage.find_one({"month": month_key()})
    return int(doc["requests"]) if doc else 0


class LocalDriver:
    """Default driver: parts are written to MEDIA_DIR on the backend host, then concatenated on complete.
    Reads are served by /api/media/{id}/stream with HTTP Range support. Works on any VM (e.g. Oracle Always Free)."""
    name = "local"

    def __init__(self):
        self.root = MEDIA_DIR
        self.root.mkdir(parents=True, exist_ok=True)

    def _parts_dir(self, m: Media) -> Path:
        return self.root / "parts" / m.media_id

    def path(self, m: Media) -> Path:
        return self.root / m.object_key

    async def init(self, m: Media) -> str:
        self._parts_dir(m).mkdir(parents=True, exist_ok=True)
        return uuid.uuid4().hex

    def part_url(self, m: Media, n: int) -> str:
        exp = int(time.time()) + URL_TTL
        return f"/api/uploads/{m.media_id}/parts/{n}?exp={exp}&sig={sign(f'part:{m.media_id}:{n}', exp)}"

    async def list_parts(self, m: Media) -> dict[int, int]:
        d = self._parts_dir(m)
        if not d.is_dir():
            return {}
        return {int(p.name): p.stat().st_size for p in d.iterdir() if p.name.isdigit()}

    async def complete(self, m: Media) -> int:
        def _concat() -> int:
            dest = self.path(m)
            dest.parent.mkdir(parents=True, exist_ok=True)
            tmp = dest.with_suffix(dest.suffix + ".tmp")
            with open(tmp, "wb") as out:
                for n in range(1, m.part_count + 1):
                    with open(self._parts_dir(m) / str(n), "rb") as src:
                        shutil.copyfileobj(src, out, 1024 * 1024)
            os.replace(tmp, dest)
            shutil.rmtree(self._parts_dir(m), ignore_errors=True)
            return dest.stat().st_size
        return await asyncio.to_thread(_concat)

    async def abort(self, m: Media):
        await asyncio.to_thread(shutil.rmtree, self._parts_dir(m), True)

    async def delete(self, m: Media):
        try:
            await asyncio.to_thread(self.path(m).unlink)
        except FileNotFoundError:
            pass

    async def read_url(self, m: Media, ttl: int) -> str:
        exp = int(time.time()) + ttl
        return f"/api/media/{m.media_id}/stream?exp={exp}&sig={sign(f'media:{m.media_id}', exp)}"


class OciDriver:
    """OCI Object Storage via its S3-compatible API (Customer Secret Keys). Credentials live only in backend env."""
    name = "oci"

    def __init__(self):
        import boto3
        from botocore.config import Config
        self.s3 = boto3.client(
            "s3", endpoint_url=OCI_S3_ENDPOINT, region_name=OCI_REGION, aws_access_key_id=OCI_ACCESS_KEY,
            aws_secret_access_key=OCI_SECRET_KEY,
            config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
        )

    async def _call(self, fn, **kw):
        await count_requests()
        return await asyncio.to_thread(getattr(self.s3, fn), Bucket=OCI_BUCKET, **kw)

    async def init(self, m: Media) -> str:
        res = await self._call("create_multipart_upload", Key=m.object_key, ContentType=m.mime)
        return res["UploadId"]

    def part_url(self, m: Media, n: int) -> str:
        return self.s3.generate_presigned_url("upload_part", ExpiresIn=URL_TTL, Params={
            "Bucket": OCI_BUCKET, "Key": m.object_key, "UploadId": m.upload_id, "PartNumber": n})

    async def _parts(self, m: Media) -> list[dict]:
        parts, marker = [], 0
        while True:
            res = await self._call("list_parts", Key=m.object_key, UploadId=m.upload_id, PartNumberMarker=marker)
            parts += res.get("Parts", [])
            if not res.get("IsTruncated"):
                return parts
            marker = res["NextPartNumberMarker"]

    async def list_parts(self, m: Media) -> dict[int, int]:
        return {p["PartNumber"]: p["Size"] for p in await self._parts(m)}

    async def complete(self, m: Media) -> int:
        parts = sorted(({"ETag": p["ETag"], "PartNumber": p["PartNumber"]} for p in await self._parts(m)), key=lambda p: p["PartNumber"])
        await self._call("complete_multipart_upload", Key=m.object_key, UploadId=m.upload_id, MultipartUpload={"Parts": parts})
        head = await self._call("head_object", Key=m.object_key)
        return int(head["ContentLength"])

    async def abort(self, m: Media):
        if m.upload_id:
            try:
                await self._call("abort_multipart_upload", Key=m.object_key, UploadId=m.upload_id)
            except Exception:
                pass

    async def delete(self, m: Media):
        await self._call("delete_object", Key=m.object_key)

    async def read_url(self, m: Media, ttl: int) -> str:
        return self.s3.generate_presigned_url("get_object", ExpiresIn=ttl, Params={"Bucket": OCI_BUCKET, "Key": m.object_key})


driver = OciDriver() if STORAGE_DRIVER == "oci" else LocalDriver()


async def audit(action: str, actor: str, media_id: str, room_code: str, extra: dict | None = None):
    await db.audit_log.insert_one({"action": action, "actor": actor, "media_id": media_id, "room_code": room_code,
                                   "extra": extra or {}, "at": datetime.now(timezone.utc)})


async def used_bytes(filt: dict | None = None) -> int:
    q = {"status": {"$in": ["uploading", "completed"]}, **(filt or {})}
    res = await db.media.aggregate([{"$match": q}, {"$group": {"_id": None, "s": {"$sum": "$size"}}}]).to_list(1)
    return int(res[0]["s"]) if res else 0


async def _media(media_id: str) -> Media:
    m = Media.from_mongo(await db.media.find_one({"media_id": media_id}))
    if not m:
        raise ApiError(404, "media_not_found", "Medya bulunamadı")
    return m


async def _owner_session(media_id: str, body: dict) -> tuple[Media, R.RoomParticipant]:
    m = await _media(media_id)
    p = await R.auth_participant(m.room_code, body.get("participant_id"), body.get("token"))
    if p.participant_id != m.owner_id:
        raise ApiError(403, "not_owner", "Bu yükleme size ait değil")
    return m, p


async def _body(request: Request) -> dict:
    try:
        data = await request.json()
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


@router.get("/storage/usage")
async def storage_usage():
    used = await used_bytes()
    reqs = await month_requests()
    return {"driver": driver.name, "used_bytes": used, "quota_bytes": STORAGE_QUOTA_BYTES,
            "percent": round(used / STORAGE_QUOTA_BYTES * 100, 2), "warn": used >= STORAGE_QUOTA_BYTES * STORAGE_WARN_RATIO,
            "max_upload_bytes": MAX_UPLOAD_BYTES, "requests_month": reqs, "request_limit": OCI_MONTHLY_REQUEST_LIMIT}


@router.post("/uploads/init")
async def upload_init(request: Request):
    b = await _body(request)
    room = await R.get_room(str(b.get("code", "")))
    p = await R.auth_participant(room.code, b.get("participant_id"), b.get("token"))
    R.require_host(p)
    filename = str(b.get("filename", ""))[:180]
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    size = b.get("size")
    if ext not in EXT_MIME:
        raise ApiError(415, "unsupported_format", "Desteklenen formatlar: MP4, M4V, WebM, MOV")
    mime = str(b.get("mime") or EXT_MIME[ext])
    if not mime.startswith("video/"):
        raise ApiError(415, "unsupported_format", "Dosya bir video değil")
    if not isinstance(size, int) or size <= 0:
        raise ApiError(400, "invalid_size", "Geçersiz dosya boyutu")
    if size > MAX_UPLOAD_BYTES:
        raise ApiError(413, "too_large", f"Dosya en fazla {MAX_UPLOAD_BYTES // 1024**2} MB olabilir")
    fingerprint = str(b.get("fingerprint") or "")[:200] or None

    if fingerprint:
        done = Media.from_mongo(await db.media.find_one({"room_code": room.code, "fingerprint": fingerprint, "status": "completed"}))
        if done:
            return {"media_id": done.media_id, "status": "completed", "deduplicated": True}
        open_ = Media.from_mongo(await db.media.find_one({"owner_id": p.participant_id, "fingerprint": fingerprint, "status": "uploading"}))
        if open_:
            return {"media_id": open_.media_id, "status": "uploading", "part_size": open_.part_size,
                    "part_count": open_.part_count, "driver": driver.name, "parts_done": sorted((await driver.list_parts(open_)).keys()),
                    "resumed": True}

    if await used_bytes() + size > STORAGE_QUOTA_BYTES:
        raise ApiError(507, "storage_quota", "Depolama kotası dolu. Eski videoları silin veya yöneticiye başvurun.")
    if await used_bytes({"owner_id": p.participant_id}) + size > PARTICIPANT_QUOTA_BYTES:
        raise ApiError(507, "user_quota", "Kişisel yükleme kotanız doldu")
    part_size = max(MIN_PART, math.ceil(size / 9000))
    part_count = math.ceil(size / part_size)
    if driver.name == "oci" and await month_requests() + part_count + 6 > OCI_MONTHLY_REQUEST_LIMIT:
        raise ApiError(429, "request_quota", "Aylık ücretsiz depolama isteği sınırına yaklaşıldı; yükleme durduruldu")

    media_id = uuid.uuid4().hex
    m = Media(media_id=media_id, room_code=room.code, owner_id=p.participant_id, filename=filename, size=size, mime=mime,
              object_key=f"rooms/{room.code}/{media_id}.{ext}", driver=driver.name, status="uploading", fingerprint=fingerprint,
              part_size=part_size, part_count=part_count, created_at=datetime.now(timezone.utc))
    m.upload_id = await driver.init(m)
    await db.media.insert_one(m.to_mongo())
    await audit("upload_init", p.participant_id, media_id, room.code, {"size": size, "filename": filename})
    return {"media_id": media_id, "status": "uploading", "part_size": part_size, "part_count": part_count,
            "driver": driver.name, "parts_done": [], "resumed": False}


@router.post("/uploads/{media_id}/part-urls")
async def upload_part_urls(media_id: str, request: Request):
    b = await _body(request)
    m, _ = await _owner_session(media_id, b)
    if m.status != "uploading":
        raise ApiError(409, "not_uploading", "Yükleme aktif değil")
    nums = [n for n in b.get("parts", []) if isinstance(n, int) and 1 <= n <= m.part_count][:50]
    return {"urls": {str(n): driver.part_url(m, n) for n in nums}, "expires_in": URL_TTL}


@router.put("/uploads/{media_id}/parts/{n}")
async def upload_part_local(media_id: str, n: int, request: Request, exp: int = 0, sig: str = ""):
    if driver.name != "local":
        raise ApiError(404, "not_found", "Yok")
    if not verify_sig(f"part:{media_id}:{n}", exp, sig):
        raise ApiError(403, "url_expired", "Yükleme bağlantısının süresi doldu")
    m = await _media(media_id)
    if m.status != "uploading" or not 1 <= n <= m.part_count:
        raise ApiError(409, "not_uploading", "Yükleme aktif değil")
    expected = m.part_size if n < m.part_count else m.size - m.part_size * (m.part_count - 1)
    pdir = driver._parts_dir(m)
    pdir.mkdir(parents=True, exist_ok=True)
    tmp = pdir / f"{n}.{uuid.uuid4().hex}.tmp"
    got = 0
    try:
        with open(tmp, "wb") as f:
            async for chunk in request.stream():
                got += len(chunk)
                if got > expected:
                    raise ApiError(413, "part_too_large", "Parça boyutu hatalı")
                f.write(chunk)
        if got != expected:
            raise ApiError(400, "part_incomplete", "Parça eksik geldi")
        os.replace(tmp, pdir / str(n))
    finally:
        if tmp.exists():
            tmp.unlink()
    return Response(status_code=200, headers={"ETag": f'"{media_id}-{n}"'})


@router.get("/uploads/{media_id}")
async def upload_status(media_id: str, participant_id: str = "", token: str = ""):
    m, _ = await _owner_session(media_id, {"participant_id": participant_id, "token": token})
    parts = await driver.list_parts(m) if m.status == "uploading" else {}
    return {"media_id": m.media_id, "status": m.status, "size": m.size, "part_size": m.part_size,
            "part_count": m.part_count, "parts_done": sorted(parts.keys()), "uploaded_bytes": sum(parts.values())}


def _upload_video(m: Media) -> dict:
    return {"url": f"nexora-media://{m.media_id}", "kind": "upload", "media_id": m.media_id, "video_id": None, "embed_url": None,
            "stream_url": None, "title": m.filename, "mime_type": m.mime, "provider": "nexora-storage", "size": m.size,
            "capabilities": {"seek": True, "rate_correction": True, "sync": True}, "warning": None}


@router.post("/uploads/{media_id}/complete")
async def upload_complete(media_id: str, request: Request):
    b = await _body(request)
    m, p = await _owner_session(media_id, b)
    room = await R.get_room(m.room_code)
    if m.status == "completed":
        if (room.video or {}).get("media_id") != media_id:
            view = await R.set_video(room, p, _upload_video(m))
            await hub.broadcast(room.code, {"type": "room", "room": view, "server_time": R.now_ms()})
            return {"media_id": media_id, "status": "completed", "room": view}
        return {"media_id": m.media_id, "status": "completed", "room": await R.room_view(room)}
    if m.status != "uploading":
        raise ApiError(409, "not_uploading", "Yükleme aktif değil")
    parts = await driver.list_parts(m)
    missing = [n for n in range(1, m.part_count + 1) if n not in parts]
    if missing or sum(parts.values()) != m.size:
        raise ApiError(409, "parts_missing", f"Eksik parçalar: {missing[:10]}")
    final_size = await driver.complete(m)
    if final_size != m.size:
        await driver.delete(m)
        await db.media.update_one({"media_id": media_id}, {"$set": {"status": "failed"}})
        raise ApiError(500, "integrity_failed", "Dosya bütünlüğü doğrulanamadı")
    await db.media.update_one({"media_id": media_id}, {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc)}})
    await audit("upload_complete", p.participant_id, media_id, m.room_code, {"size": final_size})
    view = await R.set_video(room, p, _upload_video(m))
    await hub.broadcast(room.code, {"type": "room", "room": view, "server_time": R.now_ms()})
    return {"media_id": media_id, "status": "completed", "room": view}


@router.post("/uploads/{media_id}/abort")
async def upload_abort(media_id: str, request: Request):
    m, p = await _owner_session(media_id, await _body(request))
    if m.status == "uploading":
        await driver.abort(m)
        await db.media.update_one({"media_id": media_id}, {"$set": {"status": "aborted"}})
        await audit("upload_abort", p.participant_id, media_id, m.room_code)
    return {"media_id": media_id, "status": "aborted" if m.status == "uploading" else m.status}


@router.get("/media/{media_id}/url")
async def media_url(media_id: str, participant_id: str = "", token: str = ""):
    m = await _media(media_id)
    await R.get_room(m.room_code)
    await R.auth_participant(m.room_code, participant_id, token)
    if m.status != "completed":
        raise ApiError(409, "media_unavailable", "Medya henüz hazır değil")
    ttl = 6 * 3600
    return {"url": await driver.read_url(m, ttl), "mime": m.mime, "size": m.size, "expires_in": ttl}


@router.get("/media/{media_id}/stream")
async def media_stream(media_id: str, request: Request, exp: int = 0, sig: str = ""):
    # Signature is checked for every driver (previously the OCI path redirected without any check).
    if not verify_sig(f"media:{media_id}", exp, sig):
        raise ApiError(403, "url_expired", "Medya bağlantısının süresi doldu")
    m = await _media(media_id)
    if m.status != "completed":
        raise ApiError(404, "media_not_found", "Medya bulunamadı")
    if driver.name != "local":
        return RedirectResponse(await driver.read_url(m, 3600))
    path = driver.path(m)
    if not path.is_file():
        raise ApiError(404, "media_not_found", "Medya dosyası bulunamadı")
    size = path.stat().st_size
    start, end, status = 0, size - 1, 200
    rng = request.headers.get("range")
    if rng:
        mt = re.match(r"bytes=(\d*)-(\d*)", rng)
        if not mt or (not mt.group(1) and not mt.group(2)):
            return Response(status_code=416, headers={"Content-Range": f"bytes */{size}"})
        if mt.group(1):
            start = int(mt.group(1))
            end = min(int(mt.group(2)), size - 1) if mt.group(2) else size - 1
        else:
            start = max(0, size - int(mt.group(2)))
        if start >= size or start > end:
            return Response(status_code=416, headers={"Content-Range": f"bytes */{size}"})
        status = 206

    async def chunks():
        remaining = end - start + 1
        f = await asyncio.to_thread(open, path, "rb")
        try:
            await asyncio.to_thread(f.seek, start)
            while remaining > 0:
                data = await asyncio.to_thread(f.read, min(512 * 1024, remaining))
                if not data:
                    break
                remaining -= len(data)
                yield data
        finally:
            f.close()

    headers = {"Accept-Ranges": "bytes", "Content-Length": str(end - start + 1), "Cache-Control": "private, max-age=3600"}
    if status == 206:
        headers["Content-Range"] = f"bytes {start}-{end}/{size}"
    return StreamingResponse(chunks(), status_code=status, headers=headers, media_type=m.mime)


@router.delete("/media/{media_id}")
async def media_delete(media_id: str, request: Request):
    b = await _body(request)
    m = await _media(media_id)
    p = await R.auth_participant(m.room_code, b.get("participant_id"), b.get("token"))
    if p.participant_id != m.owner_id and p.role != "host":
        raise ApiError(403, "not_owner", "Bu dosyayı silme yetkiniz yok")
    if m.status == "uploading":
        await driver.abort(m)
    elif m.status == "completed":
        await driver.delete(m)
    await db.media.update_one({"media_id": media_id}, {"$set": {"status": "deleted"}})
    await audit("media_delete", p.participant_id, media_id, m.room_code)
    room = await db.rooms.find_one({"code": m.room_code})
    if room and (room.get("video") or {}).get("media_id") == media_id and p.role == "host":
        view = await R.set_video(await R.get_room(m.room_code), p, None)
        await hub.broadcast(m.room_code, {"type": "room", "room": view, "server_time": R.now_ms()})
    return {"media_id": media_id, "status": "deleted"}


async def cleanup_once():
    now = datetime.now(timezone.utc)
    stale = now - timedelta(hours=int(os.environ.get("STALE_UPLOAD_HOURS", "24")))
    async for d in db.media.find({"status": "uploading", "created_at": {"$lt": stale}}):
        m = Media.from_mongo(d)
        await driver.abort(m)
        await db.media.update_one({"media_id": m.media_id}, {"$set": {"status": "failed"}})
        await audit("upload_cleanup", "system", m.media_id, m.room_code)
