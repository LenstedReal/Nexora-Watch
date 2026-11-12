import asyncio
import json
import logging
import time
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware

import rooms as R
from config import CORS_ORIGINS, HOST_HANDOVER_S, ROOM_PURGE_GRACE_S
from db import db, ensure_indexes
from hub import hub
from policy import check_source, public_config
from resolver import resolve
from security import ApiError, RateLimiter, api_error_response
from storage import cleanup_once, router as storage_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("nexora")

app = FastAPI(title="Nexora Watch API")
app.add_middleware(CORSMiddleware, allow_credentials=False, allow_origins=CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])
write_limiter = RateLimiter(120, 60)
metrics_limiter = RateLimiter(12, 60)  # per participant; telemetry must not use up the shared per-IP budget


@app.exception_handler(ApiError)
async def _api_error(_req, exc: ApiError):
    return api_error_response(exc)


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    path = request.url.path
    if request.method in ("POST", "PUT", "DELETE") and "/parts/" not in path and not path.endswith("/metrics"):
        # Client IP comes from uvicorn (--proxy-headers rewrites it only for trusted proxies); X-Forwarded-For is not trusted directly.
        ip = request.client.host if request.client else "?"
        if not write_limiter.allow(ip):
            return JSONResponse({"detail": "Çok fazla istek, biraz bekleyin", "code": "rate_limited"}, status_code=429)
    return await call_next(request)


async def body(request: Request) -> dict:
    try:
        data = await request.json()
        data = data if isinstance(data, dict) else {}
    except Exception:
        data = {}
    if not data.get("token") and request.headers.get("x-participant-token"):
        data["token"] = request.headers["x-participant-token"]
    return data


@app.get("/api/")
async def health():
    return {"ok": True, "service": "nexora-watch", "server_time": R.now_ms()}


@app.get("/api/time")
async def server_time():
    return {"server_time": R.now_ms()}


@app.post("/api/rooms")
async def create_room(request: Request):
    b = await body(request)
    return await R.create_room(b.get("nickname"), b.get("name"))


@app.get("/api/rooms/{code}")
async def get_room(code: str):
    room = await R.get_room(code)
    return await R.room_view(room)


@app.post("/api/rooms/{code}/join")
async def join_room(code: str, request: Request):
    b = await body(request)
    res = await R.join_room(code, b.get("nickname"), b.get("participant_id"), b.get("token"))
    msg = res.pop("_message", None)
    if not res["rejoined"]:
        if msg:  # "X joined" must show up in everyone's chat right away, not only after a reload
            await hub.broadcast(res["room"]["code"], {"type": "message", "message": msg, "server_time": R.now_ms()})
        await hub.broadcast(res["room"]["code"], {"type": "room", "room": res["room"], "server_time": R.now_ms()})
    return res


@app.get("/api/rooms/{code}/messages")
async def get_messages(code: str):
    room = await R.get_room(code)
    return await R.list_messages(room.code)


@app.post("/api/rooms/{code}/messages", status_code=201)
async def post_message(code: str, request: Request):
    b = await body(request)
    room = await R.get_room(code)
    p = await R.auth_participant(room.code, b.get("participant_id"), b.get("token"))
    msg, fresh = await R.send_message(room.code, p, b.get("text"), b.get("client_id"))
    if fresh:
        await hub.broadcast(room.code, {"type": "message", "message": msg, "server_time": R.now_ms()})
    return msg


@app.put("/api/rooms/{code}/video")
async def put_video(code: str, request: Request):
    b = await body(request)
    room = await R.get_room(code)
    p = await R.auth_participant(room.code, b.get("participant_id"), b.get("token"))
    R.require_host(p)
    if b.get("url") in (None, "") and b.get("clear"):
        video = None
    else:
        check_source(b.get("url"), b.get("referer"))
        video = await resolve(b.get("url"), b.get("referer"), b.get("title"))
    view = await R.set_video(room, p, video)
    await hub.broadcast(room.code, {"type": "room", "room": view, "server_time": R.now_ms()})
    return view


@app.put("/api/rooms/{code}/playback")
async def put_playback(code: str, request: Request):
    b = await body(request)
    room = await R.get_room(code)
    p = await R.auth_participant(room.code, b.get("participant_id"), b.get("token"))
    pb, applied = await R.apply_playback(room.code, p, b.get("playing"), b.get("position"), b.get("seq"), b.get("media_id"))
    if applied:
        await hub.broadcast(room.code, {"type": "playback", "playback": pb, "server_time": R.now_ms()})
    return {**pb, "applied": applied}


@app.post("/api/rooms/{code}/leave")
async def leave(code: str, request: Request):
    b = await body(request)
    room = await R.get_room(code)
    p = await R.auth_participant(room.code, b.get("participant_id"), b.get("token"))
    await R.set_online(room.code, p.participant_id, False)
    msg = await R.system_message(room.code, f"{p.nickname} ayrıldı", "left", p.nickname)
    await hub.broadcast(room.code, {"type": "message", "message": msg, "server_time": R.now_ms()})
    return {"ok": True}


@app.post("/api/rooms/{code}/close")
async def close(code: str, request: Request):
    b = await body(request)
    room = await R.get_room(code)
    p = await R.auth_participant(room.code, b.get("participant_id"), b.get("token"))
    await R.close_room(room, p)
    await hub.close_room(room.code, {"type": "room_closed", "code": "room_closed", "detail": "Oda sahibi odayı kapattı"})
    return {"ok": True}


@app.post("/api/resolve")
async def resolve_url(request: Request):
    b = await body(request)
    check_source(b.get("url"), b.get("referer"))
    return {"ok": True, **(await resolve(b.get("url"), b.get("referer"), b.get("title")))}


@app.get("/api/config")
async def app_config():
    return public_config()


REPORT_REASONS = {"spam", "abuse", "sexual", "violence", "copyright", "other"}
report_limiter = RateLimiter(10, 3600)


@app.post("/api/rooms/{code}/report")
async def report(code: str, request: Request):
    b = await body(request)
    code = R.normalize_code(code)
    p = await R.auth_participant(code, b.get("participant_id"), b.get("token"))
    reason = b.get("reason") if b.get("reason") in REPORT_REASONS else None
    if not reason:
        raise ApiError(400, "invalid_reason", "Geçersiz şikâyet nedeni")
    if not report_limiter.allow(p.participant_id):
        raise ApiError(429, "rate_limited", "Çok fazla şikâyet gönderdin, biraz bekle")
    target_id = b.get("target_id") if isinstance(b.get("target_id"), str) else None
    message_id = b.get("message_id") if isinstance(b.get("message_id"), str) else None
    target = await db.room_participants.find_one({"room_code": code, "participant_id": target_id}) if target_id else None
    msg = await db.room_messages.find_one({"room_code": code, "msg_id": message_id}) if message_id else None
    if msg and not target_id:
        target_id = msg.get("participant_id")
    note = b.get("note")
    await db.reports.insert_one({
        "room_code": code, "reporter_id": p.participant_id, "reporter_nickname": p.nickname,
        "target_id": target_id, "target_nickname": (target or {}).get("nickname") or (msg or {}).get("nickname"),
        "message_id": message_id, "message_text": (msg or {}).get("text"), "reason": reason,
        "note": note[:500] if isinstance(note, str) else None, "status": "open",
        "created_at": datetime.now(timezone.utc),
    })
    return {"ok": True}


@app.post("/api/rooms/{code}/kick")
async def kick(code: str, request: Request):
    b = await body(request)
    room = await R.get_room(code)
    p = await R.auth_participant(room.code, b.get("participant_id"), b.get("token"))
    R.require_host(p)
    target_id = b.get("target_id")
    if not isinstance(target_id, str) or not target_id or target_id == p.participant_id or target_id == room.host_id:
        raise ApiError(400, "invalid_target", "Bu kişi odadan çıkarılamaz")
    target = await db.room_participants.find_one_and_delete({"room_code": room.code, "participant_id": target_id})
    if not target:
        raise ApiError(404, "not_participant", "Kişi odada değil")
    await R.ban(room.code, target)  # kicked people cannot rejoin this room with the same identity
    await hub.kick(room.code, target_id, {"type": "error", "code": "kicked", "detail": "Oda sahibi seni odadan çıkardı"})
    who = target.get("nickname") or "Biri"
    msg = await R.system_message(room.code, f"{who} odadan çıkarıldı", "kicked", who)
    await hub.broadcast(room.code, {"type": "message", "message": msg, "server_time": R.now_ms()})
    view = await R.room_view(room)
    await hub.broadcast(room.code, {"type": "room", "room": view, "server_time": R.now_ms()})
    await db.audit_log.insert_one({"action": "kick", "actor": p.participant_id, "media_id": None, "room_code": room.code,
                                   "extra": {"target": target_id}, "at": datetime.now(timezone.utc)})
    return view


# --- host handover ------------------------------------------------------------------------------------------
# A room must never be left without anyone who can control it: when the host has been disconnected for
# HOST_HANDOVER_S, the longest-present online participant becomes the host. The host can also hand over manually.
_host_left: dict[str, float] = {}


async def _announce_host(code: str, old_id: str, new_id: str, msg: dict | None):
    hub.set_role(code, old_id, "guest")
    hub.set_role(code, new_id, "host")
    if msg:
        await hub.broadcast(code, {"type": "message", "message": msg, "server_time": R.now_ms()})
    view = await R.room_view(await R.get_room(code))
    await hub.broadcast(code, {"type": "room", "room": view, "server_time": R.now_ms()})
    return view


async def handover_if_needed(code: str):
    left = _host_left.get(code)
    if left is None or time.monotonic() - left < HOST_HANDOVER_S:
        return
    try:
        room = await R.get_room(code)
    except ApiError:
        _host_left.pop(code, None)
        return
    online = set(hub.online_ids(code))
    if room.host_id in online:
        _host_left.pop(code, None)
        return
    if not online:
        return  # nobody to hand over to yet; checked again when someone connects
    nxt = None
    async for d in db.room_participants.find({"room_code": code}).sort("joined_at", 1):
        if d["participant_id"] in online:
            nxt = d["participant_id"]
            break
    if not nxt:
        return
    msg = await R.transfer_host(room, nxt)
    _host_left.pop(code, None)
    if msg:
        await _announce_host(code, room.host_id, nxt, msg)
        await db.audit_log.insert_one({"action": "host_handover", "actor": "system", "media_id": None, "room_code": code,
                                       "extra": {"from": room.host_id, "to": nxt}, "at": datetime.now(timezone.utc)})


async def _handover_later(code: str):
    await asyncio.sleep(HOST_HANDOVER_S + 0.05)
    try:
        await handover_if_needed(code)
    except Exception:
        log.exception("host handover failed")


def _watch_host(code: str):
    """Start the handover clock for a room whose host is not connected."""
    if code not in _host_left:
        _host_left[code] = time.monotonic()
    asyncio.create_task(_handover_later(code))


@app.post("/api/rooms/{code}/host")
async def make_host(code: str, request: Request):
    b = await body(request)
    room = await R.get_room(code)
    p = await R.auth_participant(room.code, b.get("participant_id"), b.get("token"))
    R.require_host(p)
    target_id = b.get("target_id")
    if not isinstance(target_id, str) or not target_id or target_id == p.participant_id:
        raise ApiError(400, "invalid_target", "Oda sahipliği bu kişiye verilemez")
    msg = await R.transfer_host(room, target_id)
    _host_left.pop(room.code, None)
    view = await _announce_host(room.code, p.participant_id, target_id, msg)
    if target_id not in hub.online_ids(room.code):
        _watch_host(room.code)
    return view


@app.post("/api/rooms/{code}/metrics")
async def post_metrics(code: str, request: Request):
    b = await body(request)
    room = await R.get_room(code)
    p = await R.auth_participant(room.code, b.get("participant_id"), b.get("token"))
    if not metrics_limiter.allow(p.participant_id):
        return {"stored": 0, "limited": True}
    samples = b.get("samples") if isinstance(b.get("samples"), list) else []
    docs = []
    for s in samples[:120]:
        if not isinstance(s, dict):
            continue
        docs.append({
            "room_code": room.code, "participant_id": p.participant_id, "nickname": p.nickname,
            "role": p.role, "t": int(s.get("t") or R.now_ms()), "event": str(s.get("event", "sample"))[:32],
            **{k: float(s[k]) for k in ("drift", "rtt", "offset", "position", "buffering_ms", "cmd_sent_at",
                                         "server_at", "received_at") if isinstance(s.get(k), (int, float))},
            **{k: int(s[k]) for k in ("corrections", "reconnects", "player_errors") if isinstance(s.get(k), (int, float))},
        })
    if docs:
        await db.sync_metrics.insert_many(docs)
    return {"stored": len(docs)}


@app.get("/api/rooms/{code}/metrics/summary")
async def metrics_summary(code: str, participant_id: str = "", token: str = ""):
    code = R.normalize_code(code)
    await R.auth_participant(code, participant_id, token)
    rows = await db.sync_metrics.find({"room_code": code}, {"_id": 0}).sort("t", 1).to_list(20000)
    by: dict[str, dict] = {}
    for r in rows:
        s = by.setdefault(r["participant_id"], {"nickname": r["nickname"], "role": r["role"], "drifts": [], "rtts": [],
                                                  "corrections": 0, "reconnects": 0, "player_errors": 0, "buffering_ms": 0.0,
                                                  "latencies": []})
        if r.get("event") == "sample" and "drift" in r:
            s["drifts"].append(abs(r["drift"]))
        if "rtt" in r:
            s["rtts"].append(r["rtt"])
        if r.get("event") == "command_received" and "cmd_sent_at" in r and "received_at" in r:
            s["latencies"].append(r["received_at"] - r["cmd_sent_at"])
        for k in ("corrections", "reconnects", "player_errors"):
            s[k] = max(s[k], r.get(k, 0))
        s["buffering_ms"] += r.get("buffering_ms", 0)
    out = []
    for pid, s in by.items():
        d = s["drifts"]
        out.append({
            "participant_id": pid, "nickname": s["nickname"], "role": s["role"], "samples": len(d),
            "avg_drift_s": round(sum(d) / len(d), 3) if d else None, "max_drift_s": round(max(d), 3) if d else None,
            "over_2s": sum(1 for x in d if x > 2), "avg_rtt_ms": round(sum(s["rtts"]) / len(s["rtts"]), 1) if s["rtts"] else None,
            "avg_command_latency_ms": round(sum(s["latencies"]) / len(s["latencies"]), 1) if s["latencies"] else None,
            "corrections": s["corrections"], "reconnects": s["reconnects"], "player_errors": s["player_errors"],
            "buffering_ms": round(s["buffering_ms"]),
        })
    return {"room_code": code, "participants": out, "total_rows": len(rows)}


app.include_router(storage_router)


async def _ws_handle(ws: WebSocket, code: str, p: R.RoomParticipant, data: dict, chat_limiter: RateLimiter, seen: dict):
    t = data.get("type")
    if t == "ping":
        await hub.send(ws, {"type": "pong", "client_time": data.get("client_time"), "server_time": R.now_ms()})
        if time.monotonic() - seen.get("at", 0) > 30:
            seen["at"] = time.monotonic()
            await R.set_online(code, p.participant_id, True)
    elif t == "playback":
        pb, applied = await R.apply_playback(code, p, data.get("playing"), data.get("position"), data.get("seq"), data.get("media_id"))
        msg = {"type": "playback", "playback": pb, "server_time": R.now_ms(), "cmd_sent_at": data.get("sent_at"), "seq": data.get("seq")}
        if applied:
            await hub.broadcast(code, msg)
        else:
            await hub.send(ws, {**msg, "stale": True})
    elif t == "message":
        if not chat_limiter.allow(p.participant_id):
            await hub.send(ws, {"type": "error", "code": "rate_limited", "detail": "Çok hızlı mesaj gönderiyorsun"})
            return
        msg, fresh = await R.send_message(code, p, data.get("text"), data.get("client_id"))
        if fresh:
            await hub.broadcast(code, {"type": "message", "message": msg, "server_time": R.now_ms()})
        else:
            await hub.send(ws, {"type": "message", "message": msg, "server_time": R.now_ms()})
    elif t == "reaction":
        if data.get("emoji") in R.REACTIONS and chat_limiter.allow(p.participant_id):
            await hub.broadcast(code, {"type": "reaction", "emoji": data["emoji"], "participant_id": p.participant_id, "nickname": p.nickname})
    elif t == "buffering":
        await hub.broadcast(code, {"type": "peer_state", "participant_id": p.participant_id, "buffering": bool(data.get("buffering"))}, exclude=p.participant_id)


@app.websocket("/api/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    q = ws.query_params
    pid = q.get("participant_id") or q.get("participantId") or ""
    try:
        room = await R.get_room(q.get("code", ""))
        p = await R.auth_participant(room.code, pid, q.get("token", ""))
    except ApiError as e:
        await hub.send(ws, {"type": "error", "code": e.code, "detail": e.detail, "status": e.status})
        await ws.close(code=4410 if e.status == 410 else 4404 if e.status == 404 else 4403)
        return
    code = room.code
    await hub.add(code, pid, ws, p)
    await R.set_online(code, pid, True)
    if pid == room.host_id:
        _host_left.pop(code, None)
    elif room.host_id not in hub.online_ids(code):
        _watch_host(code)  # e.g. after a server restart: the first guest back starts the clock
    view = await R.room_view(room)
    await hub.send(ws, {"type": "hello", "room": view, "participant_id": pid, "server_time": R.now_ms()})
    await hub.broadcast(code, {"type": "presence", "participant_id": pid, "online": True, "nickname": p.nickname, "server_time": R.now_ms()}, exclude=pid)
    chat_limiter = RateLimiter(8, 5)
    frame_limiter = RateLimiter(40, 1)
    seen: dict = {"at": time.monotonic()}
    try:
        while True:
            raw = await asyncio.wait_for(ws.receive_text(), timeout=45)
            if not frame_limiter.allow(pid):
                continue
            try:
                data = json.loads(raw)
            except ValueError:
                continue
            if not isinstance(data, dict):
                continue
            try:
                await _ws_handle(ws, code, p, data, chat_limiter, seen)
            except ApiError as e:
                await hub.send(ws, {"type": "error", "code": e.code, "detail": e.detail, "status": e.status})
                if e.status == 410:
                    break
    except (WebSocketDisconnect, asyncio.TimeoutError):
        pass
    except Exception:
        log.exception("ws loop error")
    finally:
        if hub.remove(code, pid, ws):
            await R.set_online(code, pid, False)
            await hub.broadcast(code, {"type": "presence", "participant_id": pid, "online": False, "server_time": R.now_ms()})
            if p.role == "host" and hub.online_ids(code):
                _host_left[code] = time.monotonic()
                asyncio.create_task(_handover_later(code))
        try:
            await ws.close()
        except Exception:
            pass


async def maintenance_once(now: datetime | None = None):
    """One cleanup pass (also called directly by tests): expire rooms, delete media, purge ended rooms, trim logs."""
    now = now or datetime.now(timezone.utc)
    expiring = [d["code"] async for d in db.rooms.find({"status": "active", "expires_at": {"$lt": now}}, {"code": 1})]
    await db.rooms.update_many({"status": "active", "expires_at": {"$lt": now}}, {"$set": {"status": "expired"}})
    for c in expiring:
        if hub.online_ids(c):  # people still connected to a room whose 24 hours are over
            await hub.close_room(c, {"type": "error", "code": "room_expired", "detail": "Odanın süresi doldu (24 saat)", "status": 410},
                                 reason="room_expired")
        _host_left.pop(c, None)
    await cleanup_once()
    # Privacy policy: room data (room, participants, chat, playback, metrics) is deleted at most
    # ROOM_PURGE_GRACE after the room ended (closed_at for closed rooms, expires_at otherwise).
    purge_before = now - timedelta(seconds=ROOM_PURGE_GRACE_S)
    async for d in db.rooms.find({"status": {"$in": ["expired", "closed"]}}, {"code": 1, "status": 1, "expires_at": 1, "closed_at": 1}):
        ended_at = d.get("closed_at") if d.get("status") == "closed" else None
        ended_at = ended_at or d.get("expires_at")
        if ended_at and ended_at.tzinfo is None:
            ended_at = ended_at.replace(tzinfo=timezone.utc)
        if ended_at and ended_at > purge_before:
            continue
        c = d["code"]
        if await db.media.count_documents({"room_code": c, "status": {"$in": ["completed", "uploading", "importing"]}}):
            continue  # media cleanup runs first; retry on the next pass
        await db.room_messages.delete_many({"room_code": c})
        await db.sync_metrics.delete_many({"room_code": c})
        await db.room_participants.delete_many({"room_code": c})
        await db.room_playback.delete_many({"room_code": c})
        await db.room_bans.delete_many({"room_code": c})
        await db.media.delete_many({"room_code": c})  # only finished/deleted records are left at this point (file names)
        await db.rooms.delete_one({"code": c})
    # Retention promised in the privacy policy: reports 180 days, audit/security logs 90 days.
    await db.reports.delete_many({"created_at": {"$lt": now - timedelta(days=180)}})
    await db.audit_log.delete_many({"at": {"$lt": now - timedelta(days=90)}})


async def maintenance_loop():
    while True:
        try:
            await maintenance_once()
        except Exception:
            log.exception("maintenance failed")
        await asyncio.sleep(600)


@app.on_event("startup")
async def startup():
    await ensure_indexes()
    asyncio.create_task(maintenance_loop())
