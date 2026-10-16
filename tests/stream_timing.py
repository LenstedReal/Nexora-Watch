# Measures upload stream latency (TTFB / throughput) for uncached and cached parts via the public URL
import os, time, uuid, requests
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = BASE + "/api"
path = "/app/tests/sample.mp4"
size = os.path.getsize(path)
h = requests.post(f"{API}/rooms", json={"nickname": "TEST_timing"}).json()
c = {"participant_id": h["participant"]["id"], "token": h["token"]}
code = h["room"]["code"]
d = requests.post(f"{API}/uploads/init", json={"code": code, **c, "filename": "t.mp4", "size": size, "mime": "video/mp4", "fingerprint": str(uuid.uuid4())}).json()
mid, ps, pc = d["media_id"], d["part_size"], d["part_count"]
urls = requests.post(f"{API}/uploads/{mid}/part-urls", json={**c, "parts": list(range(1, pc + 1))}).json()["urls"]
with open(path, "rb") as f:
    for n in range(1, pc + 1):
        f.seek((n - 1) * ps)
        u = urls[str(n)]
        requests.put(u if u.startswith("http") else BASE + u, data=f.read(ps))
print("complete", requests.post(f"{API}/uploads/{mid}/complete", json=c).status_code)
url = BASE + requests.get(f"{API}/media/{mid}/url", params=c).json()["url"]
for label, rng in [("first 0-", "bytes=0-"), ("tail", f"bytes={size-200000}-"), ("mid part2", f"bytes={ps+100}-"), ("0- again", "bytes=0-"), ("no range", None)]:
    t0 = time.time()
    r = requests.get(url, headers={"Range": rng} if rng else {}, stream=True, timeout=120)
    first = None; total = 0
    for ch in r.iter_content(65536):
        if first is None: first = time.time() - t0
        total += len(ch)
    print(f"{label:10s} status={r.status_code} CR={r.headers.get('content-range')} ttfb={first:.2f}s total={total} in {time.time()-t0:.2f}s")
requests.post(f"{API}/rooms/{code}/close", json=c)
