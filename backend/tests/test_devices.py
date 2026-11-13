"""Devices / watched-together / invite rules (devices.py), in process with a fake push sender.
Needs the backend deps and a MongoDB (MONGO_URL), or the local in-memory stand-ins (PYTHONPATH=<shim dir>)."""
import asyncio
import os
import sys
import uuid
from datetime import timedelta

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DB_NAME", "nexora_test_devices_" + uuid.uuid4().hex[:6])
httpx = pytest.importorskip("httpx")
import devices as D  # noqa: E402
import server  # noqa: E402
from db import db  # noqa: E402

sent = []


async def fake_push(token, title, body, data):
    sent.append((token, title, body, data))
    return True, None


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro) if False else asyncio.run(coro)


async def _flow():
    D.push_sender = fake_push
    D.invite_limiter.hits.clear()
    D.register_limiter.hits.clear()
    t = httpx.ASGITransport(app=server.app)
    async with httpx.AsyncClient(transport=t, base_url="http://t") as c:
        devs = []
        for _ in range(3):
            d = {"device_id": uuid.uuid4().hex, "secret": uuid.uuid4().hex}
            r = await c.post("/api/devices", json=d)
            assert r.status_code == 200, r.text
            devs.append(d)
        h = [{"X-Nexora-Device": d["device_id"], "X-Nexora-Key": d["secret"]} for d in devs]
        # same id, wrong secret -> refused
        r = await c.post("/api/devices", json={"device_id": devs[0]["device_id"], "secret": "x" * 20})
        assert r.status_code == 409
        r = await c.get("/api/devices/me/people", headers={"X-Nexora-Device": devs[0]["device_id"], "X-Nexora-Key": "bad" * 8})
        assert r.status_code == 403
        # test notification to your own phone: needs a push token, then it is sent to that token only
        D.test_limiter.hits.clear()
        r = await c.post("/api/devices/me/test-push", headers=h[2])
        assert r.json() == {"ok": True, "sent": False, "reason": "no_push_token"}
        assert (await c.post("/api/devices/me/test-push")).status_code == 401
        await c.post("/api/devices/me/push", json={"token": "tok-self-123456", "platform": "android"}, headers=h[2])
        n0 = len(sent)
        r = await c.post("/api/devices/me/test-push", headers=h[2])
        assert r.json()["sent"] is True and sent[n0][0] == "tok-self-123456" and sent[n0][3] == {"test": "1"}
        for _ in range(4):
            await c.post("/api/devices/me/test-push", headers=h[2])
        assert (await c.post("/api/devices/me/test-push", headers=h[2])).status_code == 429
        await c.post("/api/devices/me/push", json={"token": None}, headers=h[2])
        del sent[n0:]
        # A hosts, B joins with device, C joins without device (old client)
        r = await c.post("/api/rooms", json={"nickname": "Ayşe"}, headers=h[0])
        host = r.json()
        code = host["room"]["code"]
        r = await c.post(f"/api/rooms/{code}/join", json={"nickname": "Bora"}, headers=h[1])
        guest = r.json()
        r = await c.post(f"/api/rooms/{code}/join", json={"nickname": "Can"})
        assert r.status_code == 200
        ids = [host["participant"]["id"], guest["participant"]["id"]]
        # not yet 2 minutes together -> nothing
        await D.record_room_pairs(code, ids)
        assert (await c.get("/api/devices/me/people", headers=h[0])).json()["people"] == []
        later = D._now() + timedelta(seconds=D.TOGETHER_S + 1)
        await D.record_room_pairs(code, ids, now=later)
        people = (await c.get("/api/devices/me/people", headers=h[0])).json()["people"]
        assert [p["nickname"] for p in people] == ["Bora"] and people[0]["can_invite"] is False
        assert [p["nickname"] for p in (await c.get("/api/devices/me/people", headers=h[1])).json()["people"]] == ["Ayşe"]
        assert (await c.get("/api/devices/me/people", headers=h[2])).json()["people"] == []
        auth = {"participant_id": host["participant"]["id"], "token": host["token"]}
        # invite before B has a push token: recorded, not sent
        r = await c.post(f"/api/rooms/{code}/invite", json={**auth, "to": devs[1]["device_id"]}, headers=h[0])
        assert r.json() == {"ok": True, "sent": False, "reason": "no_push_token"}
        r = await c.post("/api/devices/me/push", json={"token": "fcm-token-bbbbbbbb", "platform": "android"}, headers=h[1])
        assert r.json()["push"] is True
        r = await c.post(f"/api/rooms/{code}/invite", json={**auth, "to": devs[1]["device_id"]}, headers=h[0])
        assert r.json()["sent"] is True
        assert sent[-1][0] == "fcm-token-bbbbbbbb" and sent[-1][2] == "Ayşe seni odasına çağırıyor" and sent[-1][3]["room"] == code
        # C was never watched with -> refused; no device header -> 401; not in room -> 403
        r = await c.post(f"/api/rooms/{code}/invite", json={**auth, "to": devs[2]["device_id"]}, headers=h[0])
        assert r.status_code == 403 and r.json()["code"] == "not_watched_together"
        r = await c.post(f"/api/rooms/{code}/invite", json={**auth, "to": devs[1]["device_id"]})
        assert r.status_code == 401
        r = await c.post(f"/api/rooms/{code}/invite", json={"participant_id": "x", "token": "y", "to": devs[1]["device_id"]}, headers=h[0])
        assert r.status_code == 403
        # rate limit: 10 per hour per device (2 used)
        codes = [(await c.post(f"/api/rooms/{code}/invite", json={**auth, "to": devs[1]["device_id"]}, headers=h[0])).status_code
                 for _ in range(9)]
        assert codes == [200] * 8 + [429]
        # without a configured sender: push_not_configured
        D.push_sender = D.fcm_send
        D.invite_limiter.hits.clear()
        os.environ.pop("FCM_SERVICE_ACCOUNT_JSON", None)
        r = await c.post(f"/api/rooms/{code}/invite", json={**auth, "to": devs[1]["device_id"]}, headers=h[0])
        assert r.json()["reason"] == "push_not_configured"
        # forget one (only for me), then forget all
        r = await c.delete(f"/api/devices/me/people/{devs[1]['device_id']}", headers=h[0])
        assert (await c.get("/api/devices/me/people", headers=h[0])).json()["people"] == []
        assert len((await c.get("/api/devices/me/people", headers=h[1])).json()["people"]) == 1
        await c.delete("/api/devices/me/people", headers=h[1])
        assert (await c.get("/api/devices/me/people", headers=h[1])).json()["people"] == []
        # TTL 90 days
        await D.cleanup(D._now() + timedelta(days=91))
        assert await db.watched_pairs.count_documents({}) == 0


def test_devices_people_invite():
    asyncio.run(_flow())
