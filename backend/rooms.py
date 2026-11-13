import re
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from config import ROOM_LIFETIME_S
from db import db
from models import Room, RoomMessage, RoomParticipant, RoomPlayback
from security import ApiError, hash_token, new_token

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_RE = re.compile(r"^[A-Z2-9]{6}$")
REACTIONS = {"😀", "😂", "❤️", "🔥", "👍", "😎", "😭", "😡", "👀", "🎉", "💀", "🤣"}


def now_ms() -> int:
    return int(time.time() * 1000)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def normalize_code(code: str) -> str:
    code = (code or "").strip().upper()
    if not CODE_RE.match(code):
        raise ApiError(404, "room_not_found", "Oda bulunamadı")
    return code


def _text(value, field: str, max_len: int) -> str:
    text = value.strip() if isinstance(value, str) else ""
    if not text or len(text) > max_len:
        raise ApiError(400, f"invalid_{field}", f"{field} 1-{max_len} karakter olmalı")
    return text


_TR_SUFFIX = {**dict.fromkeys("aıâáàãå", "ın"), **dict.fromkeys("eiéèêëîíìïä", "in"),
              **dict.fromkeys("ouôóòõûúù", "un"), **dict.fromkeys("öü", "ün")}


def tr_possessive(name: str) -> str:
    """Turkish "X's" with vowel harmony: Deniz'in, Ayşe'nin, Umut'un, Gül'ün. Names that do not end in a letter get no suffix."""
    low = name.strip().replace("I", "ı").replace("İ", "i").lower()
    if not low or not low[-1].isalpha():
        return name
    last = next((c for c in reversed(low) if c in _TR_SUFFIX), None)
    if last is None:
        return f"{name}'in"
    return f"{name}'{'n' if low[-1] in _TR_SUFFIX else ''}{_TR_SUFFIX[last]}"


async def get_room(code: str) -> Room:
    code = normalize_code(code)
    room = Room.from_mongo(await db.rooms.find_one({"code": code}))
    if not room:
        raise ApiError(404, "room_not_found", "Oda bulunamadı")
    if room.status == "closed":
        raise ApiError(410, "room_closed", "Oda sahibi odayı kapattı")
    if room.status == "expired" or room.expires_at < utcnow():
        if room.status != "expired":
            await db.rooms.update_one({"code": code}, {"$set": {"status": "expired"}})
        raise ApiError(410, "room_expired", "Odanın süresi doldu (24 saat)")
    return room


def participant_view(p: RoomParticipant) -> dict:
    return {
        "id": p.participant_id,
        "nickname": p.nickname,
        "is_host": p.role == "host",
        "online": p.online,
        "joined_at": iso(p.joined_at),
        "last_seen_at": iso(p.last_seen_at),
    }


def playback_view(pb: RoomPlayback) -> dict:
    return {
        "playing": pb.is_playing,
        "position": pb.position,
        "rate": pb.rate,
        "updated_at": pb.updated_at,
        "revision": pb.revision,
        "media_id": pb.media_id,
        "updated_by": pb.updated_by,
        # Highest command sequence stored for this room: the host continues from here, so a device whose clock is
        # behind an earlier command (other device, clock correction) is never ignored as "stale".
        "seq": pb.last_seq,
    }


async def get_playback(code: str) -> RoomPlayback:
    return RoomPlayback.from_mongo(await db.room_playback.find_one({"room_code": code}))


async def room_view(room: Room) -> dict:
    from hub import hub
    live = set(hub.online_ids(room.code))
    parts = [RoomParticipant.from_mongo(d) async for d in db.room_participants.find({"room_code": room.code}).sort("joined_at", 1)]
    for p in parts:
        p.online = p.participant_id in live
    from room_queue import queue_view
    return {
        "id": room.id,
        "code": room.code,
        "name": room.name,
        "host_id": room.host_id,
        "status": room.status,
        "version": room.version,
        "created_at": iso(room.created_at),
        "expires_at": iso(room.expires_at),
        "participants": [participant_view(p) for p in parts],
        "video": room.video,
        "public": bool(room.public),
        "queue": queue_view(room.queue),
        "playback": playback_view(await get_playback(room.code)),
        "server_time": now_ms(),
    }


async def _add_participant(code: str, nickname: str, role: str) -> tuple[RoomParticipant, str]:
    token = new_token()
    now = utcnow()
    p = RoomParticipant(
        room_code=code, participant_id=str(uuid.uuid4()), nickname=nickname, role=role,
        token_hash=hash_token(token), joined_at=now, last_seen_at=now, online=False,
    )
    await db.room_participants.insert_one(p.to_mongo())
    return p, token


async def create_room(nickname_in, name_in) -> dict:
    nickname = _text(nickname_in, "nickname", 24)
    # Clients send a name in the user's language; this default only serves callers that send none.
    name = (name_in.strip() if isinstance(name_in, str) else "") or f"{tr_possessive(nickname)} odası"[:48]
    name = _text(name, "name", 48)
    now = utcnow()
    for _ in range(20):
        code = "".join(secrets.choice(ALPHABET) for _ in range(6))
        host_id = str(uuid.uuid4())
        room = Room(code=code, name=name, host_id=host_id, created_at=now, expires_at=now + timedelta(seconds=ROOM_LIFETIME_S))
        try:
            await db.rooms.insert_one(room.to_mongo())
        except DuplicateKeyError:
            continue
        token = new_token()
        host = RoomParticipant(
            room_code=code, participant_id=host_id, nickname=nickname, role="host",
            token_hash=hash_token(token), joined_at=now, last_seen_at=now,
        )
        await db.room_participants.insert_one(host.to_mongo())
        await db.room_playback.insert_one(RoomPlayback(room_code=code, updated_at=now_ms()).to_mongo())
        await system_message(code, f"{nickname} odayı kurdu", "created", nickname)
        room = await get_room(code)
        return {"room": await room_view(room), "participant": participant_view(host), "token": token}
    raise ApiError(500, "code_generation_failed", "Kod üretilemedi")


async def join_room(code: str, nickname_in, participant_id: Optional[str], token: Optional[str]) -> dict:
    room = await get_room(code)
    nickname = _text(nickname_in, "nickname", 24)
    if await is_banned(room.code, participant_id, token):
        raise ApiError(403, "kicked", "Oda sahibi seni bu odadan çıkardı")
    if participant_id and token:
        doc = await db.room_participants.find_one_and_update(
            {"room_code": room.code, "participant_id": participant_id, "token_hash": hash_token(token)},
            {"$set": {"nickname": nickname, "last_seen_at": utcnow()}},
            return_document=ReturnDocument.AFTER,
        )
        if doc:
            return {"room": await room_view(room), "participant": participant_view(RoomParticipant.from_mongo(doc)), "token": token, "rejoined": True}
    p, new_tok = await _add_participant(room.code, nickname, "guest")
    msg = await system_message(room.code, f"{nickname} odaya katıldı", "joined", nickname)
    return {"room": await room_view(room), "participant": participant_view(p), "token": new_tok, "rejoined": False, "_message": msg}


async def is_banned(code: str, participant_id, token) -> bool:
    """True when this identity was removed from the room by the host (kick = ban for the lifetime of the room)."""
    if not isinstance(participant_id, str) or not isinstance(token, str) or not participant_id or not token:
        return False
    return bool(await db.room_bans.find_one({"room_code": code, "participant_id": participant_id, "token_hash": hash_token(token)}))


async def ban(code: str, target: dict):
    await db.room_bans.insert_one({"room_code": code, "participant_id": target.get("participant_id"),
                                   "token_hash": target.get("token_hash"), "nickname": target.get("nickname"), "created_at": utcnow()})


async def transfer_host(room: Room, new_host_id: str) -> Optional[dict]:
    """Makes new_host_id the host of the room. Returns the system message, or None when nothing changed."""
    if not isinstance(new_host_id, str) or not new_host_id or new_host_id == room.host_id:
        return None
    target = await db.room_participants.find_one({"room_code": room.code, "participant_id": new_host_id})
    if not target:
        raise ApiError(404, "not_participant", "Kişi odada değil")
    res = await db.rooms.update_one({"code": room.code, "host_id": room.host_id, "status": "active"},
                                    {"$set": {"host_id": new_host_id}, "$inc": {"version": 1}})
    if not res.matched_count:
        return None  # someone else changed the host meanwhile
    await db.room_participants.update_one({"room_code": room.code, "participant_id": room.host_id}, {"$set": {"role": "guest"}})
    await db.room_participants.update_one({"room_code": room.code, "participant_id": new_host_id}, {"$set": {"role": "host"}})
    who = target.get("nickname") or "Biri"
    return await system_message(room.code, f"{who} artık oda sahibi", "host", who)


async def auth_participant(code: str, participant_id, token) -> RoomParticipant:
    if not isinstance(participant_id, str) or not isinstance(token, str) or not participant_id or not token:
        raise ApiError(401, "auth_required", "Katılımcı kimliği gerekli")
    doc = await db.room_participants.find_one({"room_code": code, "participant_id": participant_id, "token_hash": hash_token(token)})
    if not doc:
        raise ApiError(403, "not_participant", "Bu katılımcı odada değil")
    return RoomParticipant.from_mongo(doc)


def require_host(p: RoomParticipant):
    if p.role != "host":
        raise ApiError(403, "host_only", "Bu işlemi yalnızca oda sahibi yapabilir")


async def set_online(code: str, participant_id: str, online: bool):
    await db.room_participants.update_one(
        {"room_code": code, "participant_id": participant_id},
        {"$set": {"online": online, "last_seen_at": utcnow()}},
    )


async def set_video(room: Room, host: RoomParticipant, video: Optional[dict]) -> dict:
    require_host(host)
    source_id = (video or {}).get("media_id") or str(uuid.uuid4())
    if video is not None:
        video = {**video, "media_id": source_id}
    await db.rooms.update_one({"code": room.code}, {"$set": {"video": video}, "$inc": {"version": 1}})
    await db.room_playback.update_one(
        {"room_code": room.code},
        {"$set": {"media_id": source_id if video else None, "position": 0.0, "is_playing": False, "rate": 1.0,
                  "updated_at": now_ms(), "updated_by": host.participant_id}, "$inc": {"revision": 1}},
    )
    return await room_view(await get_room(room.code))


RATE_MIN, RATE_MAX = 0.25, 2.0


async def apply_playback(code: str, host: RoomParticipant, playing, position, seq, media_id, rate=None) -> tuple[dict, bool]:
    require_host(host)
    if not isinstance(playing, bool):
        raise ApiError(400, "invalid_playing", "playing boolean olmalı")
    try:
        position = float(position)
    except (TypeError, ValueError):
        raise ApiError(400, "invalid_position", "Geçersiz oynatma konumu")
    if position < 0 or position != position or position > 7 * 24 * 3600:
        raise ApiError(400, "invalid_position", "Geçersiz oynatma konumu")
    if rate is not None:
        if isinstance(rate, bool) or not isinstance(rate, (int, float)) or rate != rate or not RATE_MIN <= rate <= RATE_MAX:
            raise ApiError(400, "invalid_rate", "Geçersiz oynatma hızı")
    seq = int(seq) if isinstance(seq, (int, float)) and seq > 0 else now_ms()
    filt = {"room_code": code, "last_seq": {"$lt": seq}}
    if media_id:
        filt["media_id"] = media_id
    fields = {"is_playing": playing, "position": round(position, 3), "updated_at": now_ms(),
              "updated_by": host.participant_id, "last_seq": seq}
    if rate is not None:
        fields["rate"] = round(float(rate), 3)
    doc = await db.room_playback.find_one_and_update(
        filt,
        {"$set": fields, "$inc": {"revision": 1}},
        return_document=ReturnDocument.AFTER,
    )
    if doc:
        return playback_view(RoomPlayback.from_mongo(doc)), True
    return playback_view(await get_playback(code)), False


async def system_message(code: str, text: str, event: Optional[str] = None, subject: Optional[str] = None) -> dict:
    msg = RoomMessage(msg_id=str(uuid.uuid4()), room_code=code, nickname="Nexora", text=text, kind="system", created_at=utcnow(),
                      event=event, subject=subject)
    await db.room_messages.insert_one(msg.to_mongo())
    return message_view(msg)


def message_view(m: RoomMessage) -> dict:
    return {
        "id": m.msg_id, "room_code": m.room_code, "participant_id": m.participant_id, "nickname": m.nickname,
        "text": m.text, "kind": m.kind, "client_id": m.client_id, "created_at": iso(m.created_at),
        "event": m.event, "subject": m.subject,
    }


async def list_messages(code: str, limit: int = 200) -> list[dict]:
    docs = await db.room_messages.find({"room_code": code}).sort("created_at", -1).limit(limit).to_list(limit)
    return [message_view(RoomMessage.from_mongo(d)) for d in reversed(docs)]


async def send_message(code: str, p: RoomParticipant, text_in, client_id=None) -> tuple[dict, bool]:
    text = _text(text_in, "message", 1000)
    client_id = client_id if isinstance(client_id, str) and 0 < len(client_id) <= 64 else None
    msg = RoomMessage(msg_id=str(uuid.uuid4()), room_code=code, participant_id=p.participant_id,
                      nickname=p.nickname, text=text, client_id=client_id, created_at=utcnow())
    try:
        await db.room_messages.insert_one(msg.to_mongo())
    except DuplicateKeyError:
        existing = await db.room_messages.find_one({"room_code": code, "client_id": client_id})
        return message_view(RoomMessage.from_mongo(existing)), False
    return message_view(msg), True


async def close_room(room: Room, host: RoomParticipant):
    require_host(host)
    await db.rooms.update_one({"code": room.code}, {"$set": {"status": "closed", "closed_at": utcnow()}, "$inc": {"version": 1}})


async def set_public(room: Room, host: RoomParticipant, public) -> dict:
    require_host(host)
    if not isinstance(public, bool):
        raise ApiError(400, "invalid_public", "Geçersiz değer")
    await db.rooms.update_one({"code": room.code}, {"$set": {"public": public}, "$inc": {"version": 1}})
    return await room_view(await get_room(room.code))


async def list_public(limit: int = 20) -> list[dict]:
    """Open, public rooms for the home page. Only what a stranger may see: no participant ids, no tokens."""
    from hub import hub
    out = []
    cur = db.rooms.find({"public": True, "status": "active", "expires_at": {"$gt": utcnow()}}).sort("created_at", -1).limit(100)
    async for d in cur:
        room = Room.from_mongo(d)
        people = len(set(hub.online_ids(room.code)))
        video = room.video or {}
        out.append({"code": room.code, "name": room.name, "video_title": video.get("title") or None, "people": people})
    out.sort(key=lambda r: -r["people"])
    return out[:limit]
