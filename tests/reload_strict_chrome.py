# Reload scenarios under strict autoplay policy: guest reload (tap-to-sync) and host reload while playing
import asyncio, os, re, sys, requests
from playwright.async_api import async_playwright

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
MP4 = "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_20MB.mp4"
VT = "() => { const v=document.querySelector('[data-testid=html-video-player]'); return v? {t:+v.currentTime.toFixed(2), paused:v.paused, rs:v.readyState}: null }"


async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox", "--autoplay-policy=document-user-activation-required"])
        hc = await b.new_context(viewport={"width": 1366, "height": 900})
        gc = await b.new_context(viewport={"width": 1366, "height": 900})
        H, G = await hc.new_page(), await gc.new_page()
        await H.goto(BASE)
        await H.wait_for_selector('[data-testid="nickname-input"]', timeout=60000)
        await H.fill('[data-testid="nickname-input"]', "Çağrı")
        await H.click('[data-testid="room-submit-btn"]')
        await H.wait_for_url(re.compile(r"/room/[A-Z0-9]{6}"), timeout=15000)
        code = H.url.rstrip("/").split("/")[-1]
        await G.goto(BASE)
        await G.click('[data-testid="tab-join"]')
        await G.wait_for_timeout(300)
        tids = await G.evaluate("() => [...document.querySelectorAll('[data-testid]')].map(e=>e.dataset.testid)")
        print("join tab testids:", tids)
        await G.fill('[data-testid="nickname-input"]', "Gülşen")
        code_in = [t for t in tids if "code" in t]
        if code_in:
            await G.fill(f'[data-testid="{code_in[0]}"]', code.lower())
        await G.click('[data-testid="room-submit-btn"]')
        await G.wait_for_selector('[data-testid="room-page"]', timeout=10000)
        print("guest joined via code url:", G.url)
        await H.fill('[data-testid="source-url-input"]', MP4)
        await H.click('[data-testid="source-set-btn"]')
        await H.wait_for_selector('[data-testid="html-video-player"]', timeout=20000)
        await G.wait_for_selector('[data-testid="html-video-player"]', timeout=20000)
        await H.wait_for_timeout(2000)
        await H.click('[data-testid="html-video-player"]', position={"x": 30, "y": 30})
        await H.evaluate("() => { const v=document.querySelector('[data-testid=html-video-player]'); if (v.paused) v.play() }")
        await H.wait_for_timeout(1500)
        await G.reload()
        await G.wait_for_selector('[data-testid="html-video-player"]', timeout=20000)
        await G.wait_for_timeout(3500)
        tap = await G.locator('[data-testid="tap-to-sync-btn"]').count()
        print("guest after reload:", await G.evaluate(VT), "tap:", tap, "H:", await H.evaluate(VT))
        if tap:
            await G.click('[data-testid="tap-to-sync-btn"]')
            await G.wait_for_timeout(1500)
            print("guest after tap:", await G.evaluate(VT), "H:", await H.evaluate(VT), "tap:", await G.locator('[data-testid="tap-to-sync-btn"]').count())
        # host reload while playing
        await H.evaluate("() => { const v=document.querySelector('[data-testid=html-video-player]'); v.currentTime=1; v.loop=false }")
        await H.wait_for_timeout(1000)
        await H.reload()
        await H.wait_for_selector('[data-testid="html-video-player"]', timeout=20000)
        await H.wait_for_timeout(4000)
        pb = requests.get(f"{BASE}/api/rooms/{code}").json()["playback"]
        print("host after reload:", await H.evaluate(VT), "server playback:", pb["playing"], pb["position"], "G:", await G.evaluate(VT))
        print("host tap btn:", await H.locator('[data-testid="tap-to-sync-btn"]').count(), "host gesture-ish buttons:", await H.locator('button.gesture').count())
        await b.close()

asyncio.run(main())
