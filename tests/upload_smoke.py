import sys, os, math, httpx
API = sys.argv[1]; path = sys.argv[2]
c = httpx.Client(timeout=60)
r = c.post(f"{API}/api/rooms", json={"nickname": "Up", "name": "Upload test"}).json()
code, pid, tok = r["room"]["code"], r["participant"]["id"], r["token"]
cred = {"participant_id": pid, "token": tok}
size = os.path.getsize(path)
init = c.post(f"{API}/api/uploads/init", json={**cred, "code": code, "filename": "sample.mp4", "size": size, "mime": "video/mp4", "fingerprint": f"s:{size}"}).json()
print("init", init)
mid, ps, n = init["media_id"], init["part_size"], init["part_count"]
urls = c.post(f"{API}/api/uploads/{mid}/part-urls", json={**cred, "parts": list(range(1, n + 1))}).json()["urls"]
with open(path, "rb") as f:
    for i in range(1, n + 1):
        f.seek((i - 1) * ps); data = f.read(ps)
        rr = c.put(API + urls[str(i)], content=data); print("part", i, rr.status_code)
done = c.post(f"{API}/api/uploads/{mid}/complete", json=cred); print("complete", done.status_code, done.json().get("room", {}).get("video", {}).get("kind"))
u = c.get(f"{API}/api/media/{mid}/url", params=cred).json()["url"]
rg = c.get(API + u, headers={"Range": "bytes=100-199"}); print("range", rg.status_code, rg.headers.get("content-range"), len(rg.content))
tail = c.get(API + u, headers={"Range": f"bytes={size-50}-"}); print("tail", tail.status_code, len(tail.content))
with open(path, "rb") as f: f.seek(100); print("bytes match", f.read(100) == rg.content)
other = c.post(f"{API}/api/rooms/{code}/join", json={"nickname": "Guest"}).json()
print("guest delete", c.request("DELETE", f"{API}/api/media/{mid}", json={"participant_id": other["participant"]["id"], "token": other["token"]}).status_code)
print("bad sig", c.get(f"{API}/api/media/{mid}/stream?exp=1&sig=x").status_code)
print("guest init", c.post(f"{API}/api/uploads/init", json={"participant_id": other["participant"]["id"], "token": other["token"], "code": code, "filename": "a.mp4", "size": 10}).status_code)
print("too big", c.post(f"{API}/api/uploads/init", json={**cred, "code": code, "filename": "a.mp4", "size": 10**12}).status_code)
print("bad ext", c.post(f"{API}/api/uploads/init", json={**cred, "code": code, "filename": "a.exe", "size": 10}).status_code)
print("usage", c.get(f"{API}/api/storage/usage").json())
