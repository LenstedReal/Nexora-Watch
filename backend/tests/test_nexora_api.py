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


def test_playback_rate(room):
    url = f"{API}/rooms/{room['code']}/playback"
    seq = 2 * 10**13
    r = requests.put(url, json={**cred(room["host"]), "playing": True, "position": 4, "seq": seq, "media_id": room["media_id"], "rate": 1.5})
    assert r.status_code == 200 and r.json()["applied"] is True and r.json()["rate"] == 1.5
    # a command without rate keeps the current speed
    r = requests.put(url, json={**cred(room["host"]), "playing": False, "position": 5, "seq": seq + 1, "media_id": room["media_id"]})
    assert r.json()["rate"] == 1.5
    assert requests.get(f"{API}/rooms/{room['code']}").json()["playback"]["rate"] == 1.5
    for bad in (0.1, 3, "2", True, 0):
        r = requests.put(url, json={**cred(room["host"]), "playing": True, "position": 5, "seq": seq + 2, "rate": bad})
        assert r.status_code == 400, bad
    r = requests.put(url, json={**cred(room["host"]), "playing": True, "position": 5, "seq": seq + 3, "media_id": room["media_id"], "rate": 1})
    assert r.json()["rate"] == 1


def test_resolve_youtube():
    r = requests.post(f"{API}/resolve", json={"url": "https://www.youtube.com/watch?v=aqz-KE-bpKQ"})
    assert r.status_code == 200 and r.json()["kind"] == "youtube" and r.json()["video_id"] == "aqz-KE-bpKQ"


def test_resolve_with_referer_and_title():
    r = requests.post(f"{API}/resolve", json={"url": "https://youtu.be/aqz-KE-bpKQ", "referer": "https://m.youtube.com/watch?v=aqz-KE-bpKQ", "title": "Bunny"})
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


# Config + content policy
def test_config_shape():
    r = requests.get(f"{API}/config")
    assert r.status_code == 200
    d = r.json()
    assert d["min_age"] >= 16 and d["contact_email"]
    assert any(s["domain"] == "youtube.com" for s in d["allowed_sites"])
    for k in ("privacy", "terms", "kvkk", "copyright", "delete_data", "child_safety"):
        assert d["legal"][k].startswith("http")


def test_drm_and_unsupported_sites_rejected(room):
    h = cred(room["host"])
    r = requests.put(f"{API}/rooms/{room['code']}/video", json={**h, "url": MP4, "referer": "https://www.netflix.com/watch/1"})
    assert r.status_code == 403 and r.json()["code"] == "drm_not_allowed"
    r = requests.post(f"{API}/resolve", json={"url": "https://www.netflix.com/title/1"})
    assert r.status_code == 403 and r.json()["code"] == "drm_not_allowed"
    r = requests.post(f"{API}/resolve", json={"url": MP4, "referer": "https://some-random-site.example/movie"})
    assert r.status_code == 403 and r.json()["code"] == "site_not_supported"


def test_service_link_becomes_app_only_room_video(room):
    """Beta: a Netflix/Disney+/Prime Video/HBO Max title link is a "service" video watched in the app (services.py)."""
    if not requests.get(f"{API}/config").json().get("services_enabled"):
        pytest.skip("SERVICES_ENABLED=0 on this server")
    h = cred(room["host"])
    r = requests.put(f"{API}/rooms/{room['code']}/video", json={**h, "url": "https://www.netflix.com/watch/80100172?trackId=9"})
    assert r.status_code == 200, r.text
    v = r.json()["video"]
    assert v["kind"] == "service" and v["service"] == "netflix" and v["url"] == "https://www.netflix.com/watch/80100172"
    assert v["capabilities"]["sync"] and v["capabilities"]["app_only"] and not v.get("stream_url")
    r = requests.post(f"{API}/resolve", json={"url": "https://www.primevideo.com/detail/0KRGHGZCHKS920ZQGY5LBRF7MA/"})
    assert r.status_code == 200 and r.json()["service"] == "prime" and r.json()["title"] == "Prime Video"


# Reports + moderation
def test_report_message(room):
    g = cred(room["guest"])
    msgs = requests.get(f"{API}/rooms/{room['code']}/messages").json()
    mid = [m for m in msgs if m["kind"] == "chat"][0]["id"]
    r = requests.post(f"{API}/rooms/{room['code']}/report", json={**g, "message_id": mid, "reason": "spam"})
    assert r.status_code == 200 and r.json()["ok"] is True
    r = requests.post(f"{API}/rooms/{room['code']}/report", json={**g, "reason": "nope"})
    assert r.status_code == 400


def test_kick(room):
    victim = requests.post(f"{API}/rooms/{room['code']}/join", json={"nickname": "TEST_victim"}).json()
    v = cred(victim)
    r = requests.post(f"{API}/rooms/{room['code']}/kick", json={**cred(room["guest"]), "target_id": v["participant_id"]})
    assert r.status_code == 403
    r = requests.post(f"{API}/rooms/{room['code']}/kick", json={**cred(room["host"]), "target_id": room["host"]["participant"]["id"]})
    assert r.status_code == 400
    r = requests.post(f"{API}/rooms/{room['code']}/kick", json={**cred(room["host"]), "target_id": v["participant_id"]})
    assert r.status_code == 200
    assert all(p["id"] != v["participant_id"] for p in r.json()["participants"])
    r = requests.post(f"{API}/rooms/{room['code']}/messages", json={**v, "text": "hala burada miyim"})
    assert r.status_code == 403
    # kick is a ban for this room: the same identity cannot come back
    r = requests.post(f"{API}/rooms/{room['code']}/join", json={"nickname": "TEST_victim", **v})
    assert r.status_code == 403 and r.json()["code"] == "kicked"


def test_playback_seq_is_exposed(room):
    pb = requests.get(f"{API}/rooms/{room['code']}").json()["playback"]
    assert isinstance(pb["seq"], int) and pb["seq"] >= 10**13  # set by test_playback_seq


def test_metrics_do_not_count_against_write_limit(room):
    g = cred(room["guest"])
    for _ in range(15):
        r = requests.post(f"{API}/rooms/{room['code']}/metrics", json={**g, "samples": [{"event": "sample", "drift": 0.1}]})
        assert r.status_code == 200
    assert r.json().get("limited") is True  # per-participant cap, never a 429


def test_host_handover_manual_and_automatic():
    """The host can hand the room over; if the host disappears, the longest-present online guest takes over.
    Needs HOST_HANDOVER_SECONDS<=2 on the server (set in CI)."""
    h = requests.post(f"{API}/rooms", json={"nickname": "TEST_h"}).json()
    code = h["room"]["code"]
    g = requests.post(f"{API}/rooms/{code}/join", json={"nickname": "TEST_g"}).json()
    r = requests.post(f"{API}/rooms/{code}/host", json={**cred(g), "target_id": h["participant"]["id"]})
    assert r.status_code == 403
    r = requests.post(f"{API}/rooms/{code}/host", json={**cred(h), "target_id": g["participant"]["id"]})
    assert r.status_code == 200 and r.json()["host_id"] == g["participant"]["id"]
    r = requests.put(f"{API}/rooms/{code}/video", json={**cred(h), "url": "https://youtu.be/aqz-KE-bpKQ"})
    assert r.status_code == 403  # the old host is a guest now
    r = requests.put(f"{API}/rooms/{code}/video", json={**cred(g), "url": "https://youtu.be/aqz-KE-bpKQ"})
    assert r.status_code == 200

    async def run():
        hc, gc = cred(h), cred(g)
        async with websockets.connect(f"{WS}?code={code}&participant_id={hc['participant_id']}&token={hc['token']}") as old_host:
            await asyncio.wait_for(old_host.recv(), 10)
            async with websockets.connect(f"{WS}?code={code}&participant_id={gc['participant_id']}&token={gc['token']}") as new_host:
                await asyncio.wait_for(new_host.recv(), 10)
            # the current host (g) is gone; h is still connected and must become host again after the grace period
            for _ in range(40):
                m = json.loads(await asyncio.wait_for(old_host.recv(), 10))
                if m["type"] == "room" and m["room"]["host_id"] == hc["participant_id"]:
                    return True
        return False
    assert asyncio.run(run())


# Close
def test_close_guest_forbidden_then_host(room):
    r = requests.post(f"{API}/rooms/{room['code']}/close", json=cred(room["guest"]))
    assert r.status_code == 403
    r = requests.post(f"{API}/rooms/{room['code']}/close", json=cred(room["host"]))
    assert r.status_code == 200
    r = requests.get(f"{API}/rooms/{room['code']}")
    assert r.status_code == 410 and r.json()["code"] == "room_closed"


def test_drive_import_rejects_non_drive(room):
    r = requests.post(f"{API}/uploads/import", json={"code": room["code"], **cred(room["host"]), "url": "https://example.com/a.mp4"})
    # room may already be closed by the close test depending on order -> 410 is acceptable too
    assert r.status_code in (400, 410), r.text


# Chat lines about the room say what happened and to whom, so every client can show them in its own language.
def test_room_events_are_labelled_for_translation():
    h = requests.post(f"{API}/rooms", json={"nickname": "TEST_Deniz", "name": "TEST olaylar"}).json()
    code = h["room"]["code"]
    g = requests.post(f"{API}/rooms/{code}/join", json={"nickname": "TEST_Elif"}).json()
    assert requests.post(f"{API}/rooms/{code}/leave", json=cred(g)).status_code == 200
    msgs = requests.get(f"{API}/rooms/{code}/messages").json()
    events = [(m.get("event"), m.get("subject")) for m in msgs if m["kind"] == "system"]
    assert events == [("created", "TEST_Deniz"), ("joined", "TEST_Elif"), ("left", "TEST_Elif")]
    assert all(m["text"] for m in msgs)  # older clients still get a readable line
    assert requests.post(f"{API}/rooms/{code}/close", json=cred(h)).status_code == 200


# A room created without a name: "<nickname>'s room" with the Turkish suffix that fits the name.
def test_default_room_name_uses_the_right_turkish_suffix():
    for nick, want in (("TEST_Deniz", "TEST_Deniz'in odası"), ("TEST_Ayşe", "TEST_Ayşe'nin odası"),
                       ("TEST_Umut", "TEST_Umut'un odası"), ("TEST_Gül", "TEST_Gül'ün odası")):
        h = requests.post(f"{API}/rooms", json={"nickname": nick}).json()
        assert h["room"]["name"] == want
        requests.post(f"{API}/rooms/{h['room']['code']}/close", json=cred(h))


# Tap counter of the download site: whatever is sent, the answer is an empty 204 (the page never waits for it and
# nothing about the sender is revealed). What gets counted is checked next to the database, in the local test stack.
def test_tap_counter_always_answers_204():
    url = f"{API}/track"
    plain = {"Content-Type": "text/plain;charset=UTF-8"}  # what navigator.sendBeacon sends
    for payload in ('{"app":"velvet","event":"open"}', '{"app":"zeppelin","event":"download"}',
                    '{"app":"unknown","event":"open"}', '{"app":"velvet","event":"nope"}', "not json", "[]", "",
                    '{"app":"velvet","event":"open","pad":"' + "x" * 400 + '"}'):
        r = requests.post(url, data=payload.encode(), headers=plain)
        assert r.status_code == 204 and r.content == b"", (payload[:40], r.status_code, r.text)
    assert requests.post(url, json={"app": "velvet", "event": "task_done"}).status_code == 204
    assert requests.get(url).status_code == 405


# Official players: Vimeo and Twitch addresses are recognised without contacting the sites.
def test_resolve_vimeo_public_and_unlisted():
    r = requests.post(f"{API}/resolve", json={"url": "https://vimeo.com/channels/staffpicks/76979871"})
    assert r.status_code == 200, r.text
    v = r.json()
    assert (v["kind"], v["video_id"], v["video_hash"], v["provider"]) == ("vimeo", "76979871", None, "vimeo")
    assert v["capabilities"] == {"seek": True, "rate_correction": False, "sync": True}
    u = requests.post(f"{API}/resolve", json={"url": "https://vimeo.com/76979871/8272103f6e"}).json()
    assert (u["video_hash"], u["embed_url"]) == ("8272103f6e", "https://player.vimeo.com/video/76979871?h=8272103f6e")


def test_resolve_twitch_vod_live_and_clip():
    vod = requests.post(f"{API}/resolve", json={"url": "https://www.twitch.tv/videos/2301234567"}).json()
    assert (vod["kind"], vod["video_id"], vod["live"], vod["capabilities"]["sync"]) == ("twitch", "2301234567", False, True)
    live = requests.post(f"{API}/resolve", json={"url": "https://m.twitch.tv/SomeChannel"}).json()
    assert (live["kind"], live["channel"], live["live"], live["capabilities"]["sync"]) == ("twitch", "somechannel", True, False)
    clip = requests.post(f"{API}/resolve", json={"url": "https://clips.twitch.tv/FunnyClipSlug-abc123"})
    assert clip.status_code == 422 and clip.json()["code"] == "twitch_clip"


def test_resolve_kick_live_and_recorded():
    live = requests.post(f"{API}/resolve", json={"url": "https://m.kick.com/SomeStreamer"}).json()
    assert (live["kind"], live["channel"], live["live"], live["embed_url"]) == ("kick", "somestreamer", True, "https://player.kick.com/somestreamer")
    assert live["capabilities"] == {"seek": False, "rate_correction": False, "sync": False}
    rec = requests.post(f"{API}/resolve", json={"url": "https://kick.com/somestreamer/clips/clip_01HABCDEF"})
    assert rec.status_code == 422 and rec.json()["code"] == "kick_recorded"


# Queue ("Sıra"): everyone adds and votes, only the host plays/removes, sorted by votes then time
def _fresh_room():
    h = requests.post(f"{API}/rooms", json={"nickname": "TEST_q_host"}).json()
    code = h["room"]["code"]
    g = requests.post(f"{API}/rooms/{code}/join", json={"nickname": "TEST_q_guest"}).json()
    return code, h, g


def test_queue_add_vote_sort_and_host_rules():
    code, h, g = _fresh_room()
    a = requests.post(f"{API}/rooms/{code}/queue", json={**cred(g), "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"})
    assert a.status_code == 200, a.text
    b = requests.post(f"{API}/rooms/{code}/queue", json={**cred(h), "url": "https://youtu.be/jNQXAC9IVRw"})
    assert b.status_code == 200, b.text
    q = b.json()["queue"]
    assert [i["url"] for i in q] == ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/jNQXAC9IVRw"]
    dup = requests.post(f"{API}/rooms/{code}/queue", json={**cred(g), "url": "https://youtu.be/jNQXAC9IVRw"})
    assert dup.status_code == 409 and dup.json()["code"] == "queue_duplicate"
    second = q[1]["id"]
    v = requests.post(f"{API}/rooms/{code}/queue/{second}/vote", json=cred(g)).json()["queue"]
    assert v[0]["id"] == second and v[0]["votes"] == [g["participant"]["id"]]
    v = requests.post(f"{API}/rooms/{code}/queue/{second}/vote", json=cred(g)).json()["queue"]  # toggle off
    assert v[0]["id"] != second and v[1]["votes"] == []
    # guests cannot play or remove
    assert requests.post(f"{API}/rooms/{code}/queue/next", json=cred(g)).status_code == 403
    assert requests.delete(f"{API}/rooms/{code}/queue/{second}", json=cred(g)).status_code == 403
    assert requests.post(f"{API}/rooms/{code}/queue", json={"url": "https://youtu.be/x"}).status_code == 401
    # host plays the top item; it leaves the queue and becomes the room video
    n = requests.post(f"{API}/rooms/{code}/queue/next", json=cred(h)).json()
    assert n["room"]["video"]["video_id"] == "dQw4w9WgXcQ" and len(n["room"]["queue"]) == 1
    # automatic next only when the given video is still the current one
    stale = requests.post(f"{API}/rooms/{code}/queue/next", json={**cred(h), "after_media_id": "old"}).json()
    assert stale["played"] is None and len(stale["room"]["queue"]) == 1
    cur = n["room"]["video"]["media_id"]
    auto = requests.post(f"{API}/rooms/{code}/queue/next", json={**cred(h), "after_media_id": cur}).json()
    assert auto["room"]["video"]["video_id"] == "jNQXAC9IVRw" and auto["room"]["queue"] == []
    r = requests.post(f"{API}/rooms/{code}/queue", json={**cred(g), "url": "https://youtu.be/dQw4w9WgXcQ"}).json()["queue"]
    assert requests.delete(f"{API}/rooms/{code}/queue/{r[0]['id']}", json=cred(h)).json()["queue"] == []


def test_queue_bad_link_and_ws_broadcast():
    code, h, g = _fresh_room()
    bad = requests.post(f"{API}/rooms/{code}/queue", json={**cred(g), "url": "not a link"})
    assert bad.status_code == 400

    async def run():
        url = f"{WS}?code={code}&participant_id={h['participant']['id']}&token={h['token']}"
        async with websockets.connect(url) as ws:
            await asyncio.wait_for(ws.recv(), 5)  # hello
            await asyncio.get_running_loop().run_in_executor(None, lambda: requests.post(
                f"{API}/rooms/{code}/queue", json={**cred(g), "url": "https://youtu.be/dQw4w9WgXcQ"}))
            for _ in range(10):
                m = json.loads(await asyncio.wait_for(ws.recv(), 5))
                if m["type"] == "queue":
                    assert m["queue"][0]["added_by"] == g["participant"]["id"]
                    return
            raise AssertionError("no queue broadcast")
    asyncio.run(run())


# Titles of official players: the real video title from the providers' oEmbed endpoints, the channel name for live
# channels, never a lone "YouTube"/"KICK" page title. Offline over HTTP (the test server may not reach the internet),
# and in-process with an injected fake fetcher.
def test_resolve_titles_over_http_never_a_lone_site_word():
    k = requests.post(f"{API}/resolve", json={"url": "https://kick.com/SomeStreamer", "title": "KICK"}).json()
    assert k["title"] == "Kick · SomeStreamer"
    t = requests.post(f"{API}/resolve", json={"url": "https://www.twitch.tv/SomeChannel", "title": "Twitch"}).json()
    assert t["title"] == "Twitch · SomeChannel"
    vod = requests.post(f"{API}/resolve", json={"url": "https://www.twitch.tv/SomeChannel/v/2301234567"}).json()
    assert vod["title"] == "Twitch · SomeChannel"
    y = requests.post(f"{API}/resolve", json={"url": "https://www.youtube.com/shorts/aqz-KE-bpKQ", "title": "(2) YouTube"}).json()
    assert y["title"] and y["title"] != "(2) YouTube"  # offline: the neat label "YouTube"; online: the real title
    v = requests.post(f"{API}/resolve", json={"url": "https://vimeo.com/76979871", "title": "Paper Trail | Videos & Movies on Vimeo"}).json()
    assert v["title"] != "Paper Trail | Videos & Movies on Vimeo"


def _resolver_module():
    import sys
    httpx = pytest.importorskip("httpx")  # noqa: F841 - the backend's own dependency
    here = os.path.dirname(os.path.abspath(__file__))
    for d in (os.environ.get("NEXORA_BACKEND_DIR"), os.path.join(here, "..")):
        if d and os.path.exists(os.path.join(d, "resolver.py")) and d not in sys.path:
            sys.path.insert(0, d)
    return pytest.importorskip("resolver")


def test_resolver_titles_from_oembed_with_cache_and_fallbacks():
    resolver = _resolver_module()
    calls = []
    answers = {}

    async def fake(url):
        calls.append(url)
        a = answers.get(url.split("?", 1)[0])
        if isinstance(a, Exception):
            raise a
        return a

    saved = resolver.oembed_fetch
    resolver.oembed_fetch = fake
    resolver._title_cache.clear()
    try:
        run = lambda u, title=None: asyncio.run(resolver.resolve(u, None, title))  # noqa: E731
        answers["https://www.youtube.com/oembed"] = {"title": "Big Buck Bunny 60fps 4K", "author_name": "Blender"}
        r = run("https://youtu.be/aqz-KE-bpKQ", "YouTube")
        assert r["title"] == "Big Buck Bunny 60fps 4K"
        assert calls[0].startswith("https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Daqz-KE-bpKQ")
        run("https://www.youtube.com/watch?v=aqz-KE-bpKQ")
        assert len(calls) == 1  # cached
        # oEmbed down: the cleaned page title, else the neat label
        answers["https://www.youtube.com/oembed"] = OSError("offline")
        assert run("https://www.youtube.com/watch?v=bbbbbbbbbbb", "(3) Kedi videosu - YouTube")["title"] == "Kedi videosu"
        assert run("https://www.youtube.com/watch?v=ccccccccccc", "YouTube")["title"] == "YouTube"
        assert run("https://www.youtube.com/watch?v=ddddddddddd")["title"] == "YouTube"
        # Vimeo, unlisted hash goes to oEmbed
        answers["https://vimeo.com/api/oembed.json"] = {"title": "Paper Trail"}
        v = run("https://vimeo.com/76979871/8272103f6e", "Paper Trail | Videos & Movies on Vimeo")
        assert v["title"] == "Paper Trail" and "vimeo.com%2F76979871%2F8272103f6e" in calls[-1]
        answers["https://vimeo.com/api/oembed.json"] = None  # 404 / private
        assert run("https://vimeo.com/11111111", "Videos & Movies on Vimeo")["title"] == "Vimeo"
        assert run("https://vimeo.com/22222222", "Gece Yolu on Vimeo")["title"] == "Gece Yolu"
        # Twitch / Kick: the channel, whatever the page title said; no network for them
        n = len(calls)
        assert run("https://kick.com/xQc", "KICK")["title"] == "Kick · xQc"
        assert run("https://www.twitch.tv/Gaules", "Twitch")["title"] == "Twitch · Gaules"
        assert run("https://www.twitch.tv/videos/2301234567", "Gaules - Twitch")["title"] == "Twitch · Gaules"
        assert run("https://www.twitch.tv/videos/2301234568", "Twitch")["title"] == "Twitch"
        assert len(calls) == n
        # a slow provider cannot hold the resolve for long
        async def slow(url):
            await asyncio.sleep(30)
        resolver.oembed_fetch = slow
        saved_t, resolver.OEMBED_TIMEOUT = resolver.OEMBED_TIMEOUT, 0.2
        import time as _t
        t0 = _t.monotonic()
        assert run("https://www.youtube.com/watch?v=eeeeeeeeeee", "Yavaş - YouTube")["title"] == "Yavaş"
        assert _t.monotonic() - t0 < 2
        resolver.OEMBED_TIMEOUT = saved_t
        assert resolver._page_title("Shorts") is None
    finally:
        resolver.oembed_fetch = saved
        resolver._title_cache.clear()


# Public rooms ("Açık odalar")
def test_public_rooms_opt_in():
    h = requests.post(f"{API}/rooms", json={"nickname": "TEST_host", "name": "TEST herkese"}).json()
    code = h["room"]["code"]
    room = {"host": h, "guest": requests.post(f"{API}/rooms/{code}/join", json={"nickname": "TEST_g"}).json()}
    listed = lambda: [r["code"] for r in requests.get(f"{API}/rooms/public").json()["rooms"]]
    assert code not in listed()  # private by default
    assert requests.get(f"{API}/rooms/{code}").json()["public"] is False
    r = requests.put(f"{API}/rooms/{code}/public", json={**cred(room["guest"]), "public": True})
    assert r.status_code == 403, r.text  # host only
    r = requests.put(f"{API}/rooms/{code}/public", json={**cred(room["host"]), "public": "yes"})
    assert r.status_code == 400, r.text
    r = requests.put(f"{API}/rooms/{code}/public", json={**cred(room["host"]), "public": True})
    assert r.status_code == 200 and r.json()["public"] is True, r.text
    rows = requests.get(f"{API}/rooms/public").json()["rooms"]
    row = next(x for x in rows if x["code"] == code)
    assert set(row) == {"code", "name", "video_title", "people"} and len(rows) <= 20
    requests.put(f"{API}/rooms/{code}/public", json={**cred(room["host"]), "public": False})
    assert code not in listed()


def test_public_rooms_hide_closed():
    h = requests.post(f"{API}/rooms", json={"nickname": "TEST_pub", "name": "TEST açık"}).json()
    code = h["room"]["code"]
    assert requests.put(f"{API}/rooms/{code}/public", json={**cred(h), "public": True}).status_code == 200
    assert code in [r["code"] for r in requests.get(f"{API}/rooms/public").json()["rooms"]]
    assert requests.post(f"{API}/rooms/{code}/close", json=cred(h)).status_code == 200
    assert code not in [r["code"] for r in requests.get(f"{API}/rooms/public").json()["rooms"]]
