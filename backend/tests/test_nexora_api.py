# Nexora Watch backend regression: rooms, join, chat, playback auth/seq, video resolve, WS auth, upload+stream
import asyncio
import json
import os
import uuid

import pytest
import requests
import websockets

BASE_URL = (os.environ.get("NEXORA_API_URL") or os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"
WS = BASE_URL.replace("http", "ws", 1) + "/api/ws"
MP4 = "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_20MB.mp4"


def cred(x):
    return {"participant_id": x["participant"]["id"], "token": x["token"]}


@pytest.fixture(scope="module")
def room():
    r = requests.post(f"{API}/rooms", json={"nickname": "TEST_Çağrı", "name": "TEST oda"})
    assert r.status_code == 200, r.text
    host = r.json()
    code = host["room"]["code"]
    g = requests.post(f"{API}/rooms/{code}/join", json={"nickname": "TEST_guest"})
    assert g.status_code == 200, g.text
    return {"code": code, "host": host, "guest": g.json()}


# Health
def test_health():
    r = requests.get(f"{API}/")
    assert r.status_code == 200 and r.json()["ok"] is True


# Rooms
def test_create_room_shape(room):
    h = room["host"]
    assert h["room"]["name"] == "TEST oda"
    assert h["participant"]["nickname"] == "TEST_Çağrı"
    assert h["participant"]["is_host"] is True
    assert len(h["room"]["code"]) == 6


def test_create_room_invalid_nickname():
    r = requests.post(f"{API}/rooms", json={"nickname": "  "})
    assert r.status_code == 400


def test_get_room_and_participants(room):
    r = requests.get(f"{API}/rooms/{room['code'].lower()}")
    assert r.status_code == 200
    names = [p["nickname"] for p in r.json()["participants"]]
    assert "TEST_Çağrı" in names and "TEST_guest" in names


def test_get_room_not_found():
    assert requests.get(f"{API}/rooms/ZZZZZ2").status_code == 404
    assert requests.get(f"{API}/rooms/bad").status_code == 404


def test_rejoin_same_identity(room):
    g = room["guest"]
    r = requests.post(f"{API}/rooms/{room['code']}/join", json={"nickname": "TEST_guest", **cred(g)})
    assert r.status_code == 200
    d = r.json()
    assert d["rejoined"] is True and d["participant"]["id"] == g["participant"]["id"]
    parts = requests.get(f"{API}/rooms/{room['code']}").json()["participants"]
    assert len([p for p in parts if p["nickname"] == "TEST_guest"]) == 1


# Chat
def test_message_post_and_list(room):
    cid = str(uuid.uuid4())
    body = {**cred(room["guest"]), "text": "Merhaba ğüşiöç", "client_id": cid}
    r = requests.post(f"{API}/rooms/{room['code']}/messages", json=body)
    assert r.status_code == 201 and r.json()["text"] == "Merhaba ğüşiöç"
    r2 = requests.post(f"{API}/rooms/{room['code']}/messages", json=body)
    assert r2.json()["id"] == r.json()["id"]  # idempotent client_id
    msgs = requests.get(f"{API}/rooms/{room['code']}/messages").json()
    assert sum(1 for m in msgs if m.get("client_id") == cid) == 1


def test_message_unauth(room):
    r = requests.post(f"{API}/rooms/{room['code']}/messages", json={"text": "x"})
    assert r.status_code == 401


# Video + playback
def test_set_video_guest_forbidden(room):
    r = requests.put(f"{API}/rooms/{room['code']}/video", json={**cred(room["guest"]), "url": MP4})
    assert r.status_code == 403


def test_set_video_invalid_url(room):
    r = requests.put(f"{API}/rooms/{room['code']}/video", json={**cred(room["host"]), "url": "https://example.com"})
    assert r.status_code in (400, 415, 422), r.text
    assert r.json().get("detail")


def test_set_video_mp4(room):
    r = requests.put(f"{API}/rooms/{room['code']}/video", json={**cred(room["host"]), "url": MP4}, timeout=40)
    assert r.status_code == 200, r.text
    v = r.json()["video"]
    assert v["media_id"] and r.json()["playback"]["media_id"] == v["media_id"]
    room["media_id"] = v["media_id"]


def test_playback_guest_forbidden(room):
    r = requests.put(f"{API}/rooms/{room['code']}/playback", json={**cred(room["guest"]), "playing": True, "position": 1, "seq": 1})
    assert r.status_code == 403


def test_playback_seq(room):
    url = f"{API}/rooms/{room['code']}/playback"
    seq = 10**13
    r = requests.put(url, json={**cred(room["host"]), "playing": True, "position": 3.5, "seq": seq, "media_id": room["media_id"]})
    assert r.status_code == 200 and r.json()["applied"] is True and r.json()["position"] == 3.5
    r = requests.put(url, json={**cred(room["host"]), "playing": False, "position": 9, "seq": seq - 5, "media_id": room["media_id"]})
    assert r.json()["applied"] is False and r.json()["playing"] is True
    r = requests.put(url, json={**cred(room["host"]), "playing": "yes", "position": 1, "seq": seq + 1})
    assert r.status_code == 400
    r = requests.put(url, json={**cred(room["host"]), "playing": True, "position": -1, "seq": seq + 1})
    assert r.status_code == 400


def test_resolve_youtube():
    r = requests.post(f"{API}/resolve", json={"url": "https://www.youtube.com/watch?v=aqz-KE-bpKQ"})
    assert r.status_code == 200 and r.json()["kind"] == "youtube" and r.json()["video_id"] == "aqz-KE-bpKQ"


def test_resolve_with_referer_and_title():
    r = requests.post(f"{API}/resolve", json={"url": "https://youtu.be/aqz-KE-bpKQ", "referer": "https://example.com/watch/1", "title": "Bunny"})
    assert r.status_code == 200 and r.json()["kind"] == "youtube" and r.json()["title"] == "Bunny"
    assert "headers" not in r.json()


def test_resolve_invalid_referer():
    r = requests.post(f"{API}/resolve", json={"url": "https://youtu.be/aqz-KE-bpKQ", "referer": "javascript:x"})
    assert r.status_code == 400 and r.json()["code"] == "invalid_referer"


# WebSocket
def test_ws_bad_token_and_presence(room):
    async def run():
        async with websockets.connect(f"{WS}?code={room['code']}&participant_id=x&token=bad") as ws:
            first = json.loads(await asyncio.wait_for(ws.recv(), 10))
            assert first["type"] == "error"
            with pytest.raises(websockets.ConnectionClosed) as ex:
                await asyncio.wait_for(ws.recv(), 10)
            assert ex.value.rcvd.code == 4403
        h = cred(room["host"])
        async with websockets.connect(f"{WS}?code={room['code']}&participant_id={h['participant_id']}&token={h['token']}") as ws:
            hello = json.loads(await asyncio.wait_for(ws.recv(), 10))
            assert hello["type"] == "hello"
            me = [p for p in hello["room"]["participants"] if p["id"] == h["participant_id"]][0]
            assert me["online"] is True
            await ws.send(json.dumps({"type": "ping", "client_time": 1}))
            for _ in range(5):
                m = json.loads(await asyncio.wait_for(ws.recv(), 10))
                if m["type"] == "pong":
                    break
            assert m["type"] == "pong"
        await asyncio.sleep(1)
        r = requests.get(f"{API}/rooms/{room['code']}")
        assert r.status_code == 200
        assert all(p["online"] is False for p in r.json()["participants"])
    asyncio.run(run())


# Upload (local driver) + Range stream
SAMPLE = os.environ.get("SAMPLE_VIDEO", os.path.join(os.path.dirname(__file__), "..", "..", "tests", "sample_vp9.webm"))


def test_upload_and_range(room):
    path = SAMPLE
    size = os.path.getsize(path)
    h = cred(room["host"])
    init = requests.post(f"{API}/uploads/init", json={"code": room["code"], **h, "filename": "TEST.webm", "size": size,
                                                     "mime": "video/webm", "fingerprint": f"TEST:{uuid.uuid4()}"})
    assert init.status_code == 200, init.text
    d = init.json()
    mid, ps, pc = d["media_id"], d["part_size"], d["part_count"]
    urls = requests.post(f"{API}/uploads/{mid}/part-urls", json={**h, "parts": list(range(1, pc + 1))}).json()["urls"]
    with open(path, "rb") as f:
        for n in range(1, pc + 1):
            f.seek((n - 1) * ps)
            u = urls[str(n)]
            r = requests.put(u if u.startswith("http") else BASE_URL + u, data=f.read(ps), timeout=120)
            assert r.status_code < 300, r.text
    c = requests.post(f"{API}/uploads/{mid}/complete", json=h, timeout=60)
    assert c.status_code == 200, c.text
    assert requests.get(f"{API}/rooms/{room['code']}").json()["video"]["kind"] == "upload"
    g = requests.get(f"{API}/media/{mid}/url", params=cred(room["guest"]))
    assert g.status_code == 200
    s = requests.get(BASE_URL + g.json()["url"], headers={"Range": f"bytes={size - 1000}-"}, timeout=60)
    assert s.status_code == 206 and len(s.content) == 1000
    s = requests.get(BASE_URL + g.json()["url"], headers={"Range": "bytes=0-99"}, timeout=60)
    assert s.status_code == 206 and len(s.content) == 100
    with open(path, "rb") as f:
        assert s.content == f.read(100)
    # stream URL without a valid signature must be rejected
    assert requests.get(f"{API}/media/{mid}/stream", timeout=10).status_code == 403


def test_metrics_summary_requires_auth(room):
    assert requests.get(f"{API}/rooms/{room['code']}/metrics/summary").status_code == 401
    r = requests.get(f"{API}/rooms/{room['code']}/metrics/summary", params=cred(room["host"]))
    assert r.status_code == 200


# Close
def test_close_guest_forbidden_then_host(room):
    r = requests.post(f"{API}/rooms/{room['code']}/close", json=cred(room["guest"]))
    assert r.status_code == 403
    r = requests.post(f"{API}/rooms/{room['code']}/close", json=cred(room["host"]))
    assert r.status_code == 200
    r = requests.get(f"{API}/rooms/{room['code']}")
    assert r.status_code == 410 and r.json()["code"] == "room_closed"
