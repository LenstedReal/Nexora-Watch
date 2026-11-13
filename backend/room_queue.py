"""Room queue ("Sıra"): upcoming links everyone in the room can add and vote on; only the host plays or removes them."""
import asyncio
import uuid
from collections import defaultdict
from typing import Optional

from db import db
from rooms import ApiError, Room, RoomParticipant, require_host, utcnow, iso

QUEUE_MAX = 50
# One backend instance (see hub.py): a per-room lock makes read-change-write of the queue safe without array operators.
_locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)


def sort_queue(items: list[dict]) -> list[dict]:
    """Most votes first, then oldest first."""
    return sorted(items, key=lambda i: (-len(i.get("votes") or []), i.get("added_at") or ""))


def queue_view(items: Optional[list[dict]]) -> list[dict]:
    return [{"id": i["id"], "url": i["url"], "title": i.get("title"), "kind": i.get("kind"), "added_by": i.get("added_by"),
             "added_by_name": i.get("added_by_name"), "votes": list(i.get("votes") or []), "added_at": i.get("added_at")}
            for i in sort_queue(items or [])]


async def load(code: str) -> list[dict]:
    doc = await db.rooms.find_one({"code": code})
    return list((doc or {}).get("queue") or [])


async def _save(code: str, items: list[dict]):
    await db.rooms.update_one({"code": code}, {"$set": {"queue": items}})


async def add(room: Room, p: RoomParticipant, url: str, video: dict) -> list[dict]:
    async with _locks[room.code]:
        return await _add(room, p, url, video)


async def _add(room: Room, p: RoomParticipant, url: str, video: dict) -> list[dict]:
    items = await load(room.code)
    if len(items) >= QUEUE_MAX:
        raise ApiError(409, "queue_full", f"Sıra dolu (en çok {QUEUE_MAX})")
    if any(i.get("url") == url for i in items):
        raise ApiError(409, "queue_duplicate", "Bu bağlantı zaten sırada")
    item = {"id": str(uuid.uuid4()), "url": url, "title": (video.get("title") or "")[:200] or None, "kind": video.get("kind"),
            "added_by": p.participant_id, "added_by_name": p.nickname, "votes": [], "added_at": iso(utcnow())}
    items.append(item)
    await _save(room.code, items)
    return queue_view(items)


async def vote(room: Room, p: RoomParticipant, item_id) -> list[dict]:
    """Toggles this person's vote."""
    async with _locks[room.code]:
        items = await load(room.code)
        item = next((i for i in items if i.get("id") == item_id), None)
        if not item:
            raise ApiError(404, "queue_item_not_found", "Sıradaki video bulunamadı")
        votes = list(item.get("votes") or [])
        item["votes"] = [v for v in votes if v != p.participant_id] if p.participant_id in votes else votes + [p.participant_id]
        await _save(room.code, items)
        return queue_view(items)


async def remove(room: Room, p: RoomParticipant, item_id) -> list[dict]:
    require_host(p)
    async with _locks[room.code]:
        items = [i for i in await load(room.code) if i.get("id") != item_id]
        await _save(room.code, items)
        return queue_view(items)


async def take(room: Room, p: RoomParticipant, item_id=None, after_media_id=None) -> Optional[dict]:
    """Removes and returns the item to play: the given one, or the top one. With after_media_id (automatic "next" when a
    video ended) nothing happens unless that video is still the current one, so two triggers never skip an item."""
    require_host(p)
    if after_media_id is not None and (room.video or {}).get("media_id") != after_media_id:
        return None
    async with _locks[room.code]:
        if after_media_id is not None:
            doc = await db.rooms.find_one({"code": room.code}) or {}
            if doc.get("queue_after") == after_media_id:
                return None  # this video already moved the queue on (a second trigger while the first one loads)
            await db.rooms.update_one({"code": room.code}, {"$set": {"queue_after": after_media_id}})
        items = await load(room.code)
        ordered = sort_queue(items)
        item = next((i for i in ordered if i.get("id") == item_id), None) if item_id else (ordered[0] if ordered else None)
        if not item:
            if item_id:
                raise ApiError(404, "queue_item_not_found", "Sıradaki video bulunamadı")
            return None
        await _save(room.code, [i for i in items if i.get("id") != item["id"]])
        return item
