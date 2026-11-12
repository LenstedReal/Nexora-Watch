import json
import logging

from fastapi import WebSocket

log = logging.getLogger("nexora.hub")


class Hub:
    """In-process room fan-out. Single backend instance; multi-instance needs a shared bus (see docs/ARCHITECTURE.md)."""

    def __init__(self):
        self.rooms: dict[str, dict[str, WebSocket]] = {}
        # Live participant objects of connected sockets, so a role change (host handover) reaches open connections.
        self.people: dict[str, dict[str, object]] = {}

    async def add(self, code: str, pid: str, ws: WebSocket, participant=None):
        peers = self.rooms.setdefault(code, {})
        old = peers.get(pid)
        peers[pid] = ws
        if participant is not None:
            self.people.setdefault(code, {})[pid] = participant
        if old is not None and old is not ws:
            try:
                await old.close(code=4000, reason="replaced")
            except Exception:
                pass

    def remove(self, code: str, pid: str, ws: WebSocket) -> bool:
        peers = self.rooms.get(code, {})
        if peers.get(pid) is ws:
            del peers[pid]
            self.people.get(code, {}).pop(pid, None)
            if not peers:
                self.rooms.pop(code, None)
                self.people.pop(code, None)
            return True
        return False

    def set_role(self, code: str, pid: str, role: str):
        p = self.people.get(code, {}).get(pid)
        if p is not None:
            p.role = role

    def online_ids(self, code: str) -> list[str]:
        return list(self.rooms.get(code, {}).keys())

    async def send(self, ws: WebSocket, data: dict):
        try:
            await ws.send_text(json.dumps(data, ensure_ascii=False))
        except Exception:
            pass

    async def send_to(self, code: str, pid: str, data: dict):
        """Sends to one participant of a room, if connected."""
        ws = self.rooms.get(code, {}).get(pid)
        if ws is not None:
            await self.send(ws, data)

    async def broadcast(self, code: str, data: dict, exclude: str | None = None):
        payload = json.dumps(data, ensure_ascii=False)
        for pid, ws in list(self.rooms.get(code, {}).items()):
            if pid == exclude:
                continue
            try:
                await ws.send_text(payload)
            except Exception:
                self.remove(code, pid, ws)

    async def kick(self, code: str, pid: str, data: dict | None = None):
        ws = self.rooms.get(code, {}).get(pid)
        if ws is None:
            return
        if data:
            await self.send(ws, data)
        self.remove(code, pid, ws)
        try:
            await ws.close(code=4403, reason="kicked")
        except Exception:
            pass

    async def close_room(self, code: str, data: dict, reason: str = "room_closed"):
        await self.broadcast(code, data)
        for pid, ws in list(self.rooms.get(code, {}).items()):
            try:
                await ws.close(code=4410, reason=reason)
            except Exception:
                pass
        self.rooms.pop(code, None)
        self.people.pop(code, None)


hub = Hub()
