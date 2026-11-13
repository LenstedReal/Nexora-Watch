"""Anonymous devices, "watched together" people and room invites with push (docs/PUSH.md).

No accounts: a device is a random id + secret the client keeps (localStorage nx:dev). The server stores only
sha256(secret). Two devices that were online in the same room for >= TOGETHER_S become a pair; each side sees the
other's last nickname. Nothing is shown to anyone but the two devices. Data lives PEOPLE_TTL_DAYS.
Push: Firebase Cloud Messaging HTTP v1 with a service account (env FCM_SERVICE_ACCOUNT_JSON). Without it invites
are still recorded and the API answers {sent: false, reason: "push_not_configured"}."""
import json
import logging
import os
import re
import time
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Request

import rooms as R
from db import db
from security import ApiError, RateLimiter, hash_token

log = logging.getLogger("nexora.devices")
router = APIRouter()

TOGETHER_S = int(os.environ.get("TOGETHER_SECONDS", "120"))
PEOPLE_TTL_DAYS = 90
MAX_PEOPLE = 30
ID_RE = re.compile(r"^[A-Za-z0-9_-]{16,64}$")
register_limiter = RateLimiter(10, 3600)   # per IP
invite_limiter = RateLimiter(10, 3600)     # per sending device
test_limiter = RateLimiter(5, 3600)        # test notifications per device


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _json(request: Request) -> dict:
    try:
        data = await request.json()
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


async def device_from_headers(request: Request, required: bool = True) -> dict | None:
    dev_id = request.headers.get("x-nexora-device") or ""
    key = request.headers.get("x-nexora-key") or ""
    if not dev_id or not key:
        if required:
            raise ApiError(401, "device_required", "Cihaz kimliği gerekli")
        return None
    doc = await db.devices.find_one({"device_id": dev_id, "secret_hash": hash_token(key)})
    if not doc and required:
        raise ApiError(403, "device_unknown", "Cihaz tanınmadı")
    if doc:  # "last used", so an unused device record can be deleted after PEOPLE_TTL_DAYS (privacy policy)
        await db.devices.update_one({"device_id": dev_id}, {"$set": {"last_seen": _now()}})
    return doc


@router.post("/api/devices")
async def register_device(request: Request):
    b = await _json(request)
    dev_id, secret = b.get("device_id"), b.get("secret")
    if not isinstance(dev_id, str) or not ID_RE.match(dev_id) or not isinstance(secret, str) or not 16 <= len(secret) <= 128:
        raise ApiError(400, "invalid_device", "Geçersiz cihaz kimliği")
    existing = await db.devices.find_one({"device_id": dev_id})
    if existing:
        if existing.get("secret_hash") != hash_token(secret):
            raise ApiError(409, "device_taken", "Bu cihaz kimliği kullanılıyor")
        return {"ok": True, "device_id": dev_id, "push": bool(existing.get("push_token"))}
    ip = request.client.host if request.client else "?"
    if not register_limiter.allow(ip):
        raise ApiError(429, "rate_limited", "Çok fazla istek, biraz bekleyin")
    await db.devices.insert_one({"device_id": dev_id, "secret_hash": hash_token(secret), "created": _now(),
                                 "last_seen": _now(), "push_token": None, "platform": None})
    return {"ok": True, "device_id": dev_id, "push": False}


@router.post("/api/devices/me/push")
async def set_push_token(request: Request):
    dev = await device_from_headers(request)
    b = await _json(request)
    tok = b.get("token")
    platform = b.get("platform") if b.get("platform") in ("android", "ios", "web") else None
    if tok is not None and (not isinstance(tok, str) or not 10 <= len(tok) <= 4096):
        raise ApiError(400, "invalid_token", "Geçersiz bildirim anahtarı")
    await db.devices.update_one({"device_id": dev["device_id"]}, {"$set": {"push_token": tok, "platform": platform, "last_seen": _now()}})
    return {"ok": True, "push": bool(tok)}


def _pair_id(a: str, b: str) -> str:
    return "|".join(sorted([a, b]))


async def record_pair(a: dict, b: dict, now: datetime | None = None):
    """a/b: participant docs with device_id + nickname, online together long enough."""
    da, db_ = a.get("device_id"), b.get("device_id")
    if not da or not db_ or da == db_:
        return
    now = now or _now()
    first, second = sorted([(da, a), (db_, b)], key=lambda x: x[0])
    await db.watched_pairs.update_one(
        {"pair": _pair_id(da, db_)},
        {"$set": {"pair": _pair_id(da, db_), "a": first[0], "b": second[0], "nick_a": first[1].get("nickname"),
                  "nick_b": second[1].get("nickname"), "last": now, "hidden_a": False, "hidden_b": False}},
        upsert=True,
    )


async def record_room_pairs(code: str, online_ids: list[str], now: datetime | None = None):
    """Called periodically: every two online participants with a device who are both in the room >= TOGETHER_S."""
    now = now or _now()
    since = now - timedelta(seconds=TOGETHER_S)
    people = []
    for pid in online_ids:
        d = await db.room_participants.find_one({"room_code": code, "participant_id": pid})
        if not d or not d.get("device_id"):
            continue
        t = d.get("together_since") or d.get("joined_at")
        if t and t.tzinfo is None:
            t = t.replace(tzinfo=timezone.utc)
        if t and t <= since:
            people.append(d)
    for i in range(len(people)):
        for j in range(i + 1, len(people)):
            await record_pair(people[i], people[j], now)


async def attach_device(code: str, participant_id: str, dev: dict | None):
    if dev:
        await db.room_participants.update_one({"room_code": code, "participant_id": participant_id},
                                              {"$set": {"device_id": dev["device_id"], "together_since": _now()}})


async def _people(dev_id: str) -> list[dict]:
    cutoff = _now() - timedelta(days=PEOPLE_TTL_DAYS)
    out = []
    for side, other, nick in (("a", "b", "nick_b"), ("b", "a", "nick_a")):
        async for p in db.watched_pairs.find({side: dev_id}):
            last = p.get("last")
            if last and last.tzinfo is None:
                last = last.replace(tzinfo=timezone.utc)
            if p.get(f"hidden_{side}") or not last or last < cutoff:
                continue
            target = await db.devices.find_one({"device_id": p[other]})
            out.append({"device_id": p[other], "nickname": p.get(nick) or "?", "last": last,
                        "can_invite": bool(target and target.get("push_token"))})
    out.sort(key=lambda x: x["last"], reverse=True)
    return out[:MAX_PEOPLE]


@router.get("/api/devices/me/people")
async def list_people(request: Request):
    dev = await device_from_headers(request)
    return {"people": [{**p, "last": p["last"].isoformat()} for p in await _people(dev["device_id"])]}


@router.delete("/api/devices/me/people/{other}")
async def forget_person(other: str, request: Request):
    dev = await device_from_headers(request)
    me = dev["device_id"]
    pair = await db.watched_pairs.find_one({"pair": _pair_id(me, other)})
    if pair:
        side = "a" if pair["a"] == me else "b"
        await db.watched_pairs.update_one({"pair": pair["pair"]}, {"$set": {f"hidden_{side}": True}})
    return {"ok": True}


@router.delete("/api/devices/me/people")
async def forget_all(request: Request):
    dev = await device_from_headers(request)
    me = dev["device_id"]
    await db.watched_pairs.update_many({"a": me}, {"$set": {"hidden_a": True}})
    await db.watched_pairs.update_many({"b": me}, {"$set": {"hidden_b": True}})
    return {"ok": True}


# --- push ----------------------------------------------------------------------------------------------------
_fcm_cache: dict = {}


def _fcm_raw() -> str:
    """The service account: FCM_SERVICE_ACCOUNT_B64 (base64 of the JSON file, one line, fits a .env file),
    or FCM_SERVICE_ACCOUNT_JSON (the JSON itself or a path to the file)."""
    b64 = (os.environ.get("FCM_SERVICE_ACCOUNT_B64") or "").strip()
    if b64:
        try:
            import base64
            return base64.b64decode(b64).decode("utf-8")
        except Exception:
            return ""
    return os.environ.get("FCM_SERVICE_ACCOUNT_JSON") or ""


def fcm_configured() -> bool:
    return bool(_fcm_raw())


async def _fcm_access_token(sa: dict) -> str:
    if _fcm_cache.get("exp", 0) > time.time() + 60:
        return _fcm_cache["token"]
    import httpx
    import jwt  # PyJWT[crypto] signs RS256 with the service account key (requirements.txt)
    now = int(time.time())
    assertion = jwt.encode({"iss": sa["client_email"], "scope": "https://www.googleapis.com/auth/firebase.messaging",
                            "aud": sa.get("token_uri") or "https://oauth2.googleapis.com/token", "iat": now, "exp": now + 3600},
                           sa["private_key"], algorithm="RS256")
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(sa.get("token_uri") or "https://oauth2.googleapis.com/token",
                         data={"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": assertion})
        r.raise_for_status()
        j = r.json()
    _fcm_cache.update(token=j["access_token"], exp=now + int(j.get("expires_in", 3600)))
    return j["access_token"]


async def fcm_send(push_token: str, title: str, body: str, data: dict) -> tuple[bool, str | None]:
    raw = _fcm_raw()
    if not raw:
        return False, "push_not_configured"
    try:
        sa = json.loads(raw if raw.strip().startswith("{") else open(raw).read())
        import httpx
        token = await _fcm_access_token(sa)
        msg = {"message": {"token": push_token, "notification": {"title": title, "body": body},
                           "data": {k: str(v) for k, v in data.items()},
                           "android": {"priority": "high", "notification": {"channel_id": "invites"}}}}
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post(f"https://fcm.googleapis.com/v1/projects/{sa['project_id']}/messages:send",
                             json=msg, headers={"Authorization": f"Bearer {token}"})
        if r.status_code in (404, 400) and "UNREGISTERED" in r.text:
            return False, "token_unregistered"
        return (r.status_code == 200), (None if r.status_code == 200 else "push_failed")
    except Exception:
        log.exception("fcm send failed")
        return False, "push_failed"


# Tests replace this with a fake sender.
push_sender = fcm_send


@router.post("/api/devices/me/test-push")
async def test_push(request: Request):
    """Sends a test notification to the caller's own phone (Settings → "Test bildirimi gönder")."""
    dev = await device_from_headers(request)
    if not test_limiter.allow(dev["device_id"]):
        raise ApiError(429, "rate_limited", "Çok fazla deneme, biraz bekle")
    if not dev.get("push_token"):
        return {"ok": True, "sent": False, "reason": "no_push_token"}
    if push_sender is fcm_send and not fcm_configured():
        return {"ok": True, "sent": False, "reason": "push_not_configured"}
    sent, reason = await push_sender(dev["push_token"], "Nexora Watch", "Test bildirimi: bildirimler çalışıyor 🎉", {"test": "1"})
    if reason == "token_unregistered":
        await db.devices.update_one({"device_id": dev["device_id"]}, {"$set": {"push_token": None}})
    return {"ok": True, "sent": sent, "reason": reason}


@router.post("/api/rooms/{code}/invite")
async def invite(code: str, request: Request):
    b = await _json(request)
    if not b.get("token") and request.headers.get("x-participant-token"):
        b["token"] = request.headers["x-participant-token"]
    room = await R.get_room(code)
    p = await R.auth_participant(room.code, b.get("participant_id"), b.get("token"))
    dev = await device_from_headers(request)
    to = b.get("to")
    if not isinstance(to, str) or not to:
        raise ApiError(400, "invalid_target", "Kişi seçilmedi")
    if not any(x["device_id"] == to for x in await _people(dev["device_id"])):
        raise ApiError(403, "not_watched_together", "Bu kişiyi yalnızca birlikte izlediysen çağırabilirsin")
    if not invite_limiter.allow(dev["device_id"]):
        raise ApiError(429, "rate_limited", "Çok fazla davet gönderdin, biraz bekle")
    target = await db.devices.find_one({"device_id": to})
    await db.invites.insert_one({"from": dev["device_id"], "to": to, "room_code": room.code, "at": _now()})
    if not target or not target.get("push_token"):
        return {"ok": True, "sent": False, "reason": "no_push_token"}
    if push_sender is fcm_send and not fcm_configured():
        return {"ok": True, "sent": False, "reason": "push_not_configured"}
    nick = p.nickname or "Biri"
    sent, reason = await push_sender(target["push_token"], "Nexora Watch", f"{nick} seni odasına çağırıyor",
                                     {"room": room.code, "url": f"nexora://room/{room.code}"})
    if reason == "token_unregistered":
        await db.devices.update_one({"device_id": to}, {"$set": {"push_token": None}})
    return {"ok": True, "sent": sent, "reason": reason}


async def cleanup(now: datetime | None = None):
    now = now or _now()
    await db.watched_pairs.delete_many({"last": {"$lt": now - timedelta(days=PEOPLE_TTL_DAYS)}})
    await db.invites.delete_many({"at": {"$lt": now - timedelta(days=PEOPLE_TTL_DAYS)}})
    await db.devices.delete_many({"last_seen": {"$lt": now - timedelta(days=PEOPLE_TTL_DAYS)}})
