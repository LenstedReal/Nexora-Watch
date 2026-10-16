# Backend restart reconnect test: both clients must reconnect, room + playback preserved, presence 2/2
import asyncio, os, re, subprocess, time, requests
from playwright.async_api import async_playwright

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
MP4 = "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_20MB.mp4"
VT = "() => { const v=document.querySelector('[data-testid=html-video-player]'); return v? {t:+v.currentTime.toFixed(2), paused:v.paused}: null }"
ST = "() => ({s: document.querySelector('[data-testid=connection-status]')?.innerText, pc: document.querySelector('[data-testid=participants-count]')?.innerText, banner: document.querySelector('[data-testid=connection-banner]')?.innerText})"


async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        H = await (await b.new_context()).new_page()
        G = await (await b.new_context()).new_page()
        await H.goto(BASE)
        await H.wait_for_selector('[data-testid="nickname-input"]', timeout=60000)
        await H.fill('[data-testid="nickname-input"]', "Çağrı")
        await H.click('[data-testid="room-submit-btn"]')
        await H.wait_for_url(re.compile(r"/room/[A-Z0-9]{6}"), timeout=15000)
        code = H.url.rstrip("/").split("/")[-1]
        await G.goto(H.url)
        await G.fill('[data-testid="invite-nickname-input"]', "Gülşen")
        await G.click('[data-testid="invite-join-btn"]')
        await G.wait_for_selector('[data-testid="room-page"]')
        await H.fill('[data-testid="source-url-input"]', MP4)
        await H.click('[data-testid="source-set-btn"]')
        await G.wait_for_selector('[data-testid="html-video-player"]', timeout=20000)
        await H.wait_for_timeout(2000)
        await H.click('[data-testid="html-video-player"]', position={"x": 30, "y": 30})
        await H.evaluate("() => { const v=document.querySelector('[data-testid=html-video-player]'); v.loop=false; if (v.paused) v.play() }")
        await H.wait_for_timeout(1500)
        await H.evaluate("() => document.querySelector('[data-testid=html-video-player]').pause()")
        await H.wait_for_timeout(1000)
        print("before restart H", await H.evaluate(ST), await H.evaluate(VT), "G", await G.evaluate(ST), await G.evaluate(VT))
        subprocess.run(["sudo", "supervisorctl", "restart", "backend"], capture_output=True)
        t0 = time.time()
        for i in range(12):
            await H.wait_for_timeout(2500)
            hs, gs = await H.evaluate(ST), await G.evaluate(ST)
            print(f"+{time.time()-t0:.0f}s H {hs} G {gs}")
            if hs["s"] == "Connected" and gs["s"] == "Connected" and hs["pc"] == "2/2" and gs["pc"] == "2/2":
                break
        await H.wait_for_timeout(1500)
        print("after H", await H.evaluate(ST), await H.evaluate(VT), "G", await G.evaluate(ST), await G.evaluate(VT))
        r = requests.get(f"{BASE}/api/rooms/{code}").json()
        print("server:", r["playback"]["playing"], r["playback"]["position"], [(p["nickname"], p["online"]) for p in r["participants"]])
        # chat after reconnect
        await G.fill('[data-testid="chat-input"]', "reconnect sonrası")
        await G.click('[data-testid="chat-send-btn"]')
        await H.wait_for_timeout(1500)
        print("host sees:", await H.locator('[data-testid="chat-message"]').all_inner_texts())
        print("host sys:", await H.locator('.m.sys').all_inner_texts())
        await b.close()

asyncio.run(main())
