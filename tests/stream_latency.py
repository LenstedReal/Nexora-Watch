import os, sys, time, httpx
API = sys.argv[1]; path = sys.argv[2]
c = httpx.Client(timeout=120)
r = c.post(f"{API}/api/rooms", json={"nickname": "Up", "name": "Latency"}).json()
code, pid, tok = r["room"]["code"], r["participant"]["id"], r["token"]
cred = {"participant_id": pid, "token": tok}
size = os.path.getsize(path)
init = c.post(f"{API}/api/uploads/init", json={**cred, "code": code, "filename": "big.mp4", "size": size, "mime": "video/mp4", "fingerprint": f"b:{size}:{time.time()}"}).json()
mid, ps, n = init["media_id"], init["part_size"], init["part_count"]
print("parts", n, "part_size", ps)
urls = c.post(f"{API}/api/uploads/{mid}/part-urls", json={**cred, "parts": list(range(1, n + 1))}).json()["urls"]
t0 = time.time()
with open(path, "rb") as f:
    for i in range(1, n + 1):
        f.seek((i - 1) * ps); data = f.read(ps)
        t = time.time(); rr = c.put(API + urls[str(i)], content=data); print("part", i, rr.status_code, f"{time.time()-t:.1f}s")
print("upload total", f"{time.time()-t0:.1f}s")
done = c.post(f"{API}/api/uploads/{mid}/complete", json=cred); print("complete", done.status_code)
u = API + c.get(f"{API}/api/media/{mid}/url", params=cred).json()["url"]
print("ROOM", code, "URL", u)
for rng in ["bytes=0-", f"bytes={size-2048}-", "bytes=0-", f"bytes={ps*2+5}-", f"bytes={ps*2+5}-"]:
    t = time.time()
    with c.stream("GET", u, headers={"Range": rng}) as s:
        first = None; got = 0
        for chunk in s.iter_bytes():
            if first is None: first = time.time() - t
            got += len(chunk)
            if got > 4 * 1024 * 1024: break
    print(rng, s.status_code, s.headers.get("content-range"), f"ttfb={first:.2f}s got={got} total={time.time()-t:.2f}s")
