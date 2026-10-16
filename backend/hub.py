import json
import logging

from fastapi import WebSocket

log = logging.getLogger("nexora.hub")


class Hub:
    """In-process room fan-out. Single backend instance; multi-instance needs a shared bus (see docs/ARCHITECTURE.md)."""

    def __init__(self):
        self.rooms: dict[str, dict[str, WebSocket]] = {}

    async def add(self, code: str, pid: str, ws: WebSocket):
        peers = self.rooms.setdefault(code, {})
        old = peers.get(pid)
        peers[pid] = ws
        if old is not None and old is not ws:
            try:
                await old.close(code=4000, reason="replaced")
            except Exception:
                pass

    def remove(self, code: str, pid: str, ws: WebSocket) -> bool:
        peers = self.rooms.get(code, {})
        if peers.get(pid) is ws:
            del peers[pid]
            if not peers:
                self.rooms.pop(code, None)
            return True
        return False

    def online_ids(self, code: str) -> list[str]:
        return list(self.rooms.get(code, {}).keys())

    async def send(self, ws: WebSocket, data: dict):
        try:
            await ws.send_text(json.dumps(data, ensure_ascii=False))
        except Exception:
            pass

    async def broadcast(self, code: str, data: dict, exclude: str | None = None):
        payload = json.dumps(data, ensure_ascii=False)
        for pid, ws in list(self.rooms.get(code, {}).items()):
            if pid == exclude:
                continue
            try:
                await ws.send_text(payload)
            except Exception:
                self.remove(code, pid, ws)

    async def close_room(self, code: str, data: dict):
        await self.broadcast(code, data)
        for pid, ws in list(self.rooms.get(code, {}).items()):
            try:
                await ws.close(code=4410, reason="room_closed")
            except Exception:
                pass
        self.rooms.pop(code, None)


hub = Hub()
