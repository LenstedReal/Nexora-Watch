import asyncio, json, os, sys
import httpx, websockets

API = os.environ.get("API", "http://localhost:8001")
WS = API.replace("http", "ws", 1)


async def main():
    async with httpx.AsyncClient(base_url=API, timeout=20) as c:
        r = (await c.post("/api/rooms", json={"nickname": "Host", "name": "Probe"})).json()
        print("room", json.dumps(r)[:300])
        code = r["room"]["code"] if "room" in r else r["code"]
        ident = {"participant_id": r["room"]["host_id"], "token": r["token"]}
        print("ident", ident)
        url = f"{WS}/api/ws?code={code}&participant_id={ident['participant_id']}&token={ident['token']}"
        async with websockets.connect(url) as ws:
            print("hello", (await ws.recv())[:120])
            await ws.send(json.dumps({"type": "message", "text": "🔥", "client_id": "c1"}))
            for _ in range(3):
                try:
                    m = await asyncio.wait_for(ws.recv(), 3)
                    print("recv", m[:300])
                except asyncio.TimeoutError:
                    print("timeout")
                    break
        print("list", (await c.get(f"/api/rooms/{code}/messages")).text[:300])


asyncio.run(main())
