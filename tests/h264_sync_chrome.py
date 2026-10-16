# Two-context H.264 test using system Chromium (has proprietary codecs) - MP4 link + H.264 upload sync
import asyncio, os, re, sys
from playwright.async_api import async_playwright

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
MP4 = "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_20MB.mp4"
VT = "() => { const v=document.querySelector('[data-testid=html-video-player]'); return v? {t:+v.currentTime.toFixed(2), paused:v.paused, rs:v.readyState, dur:v.duration, err: v.error&&v.error.code, rate:+v.playbackRate.toFixed(3)}: null }"
MODE = sys.argv[1] if len(sys.argv) > 1 else "link"


async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox", "--autoplay-policy=document-user-activation-required"] if "strict" in sys.argv else ["--no-sandbox"])
        hc = await b.new_context(viewport={"width": 1366, "height": 900})
        gc = await b.new_context(viewport={"width": 1366, "height": 900})
        H, G = await hc.new_page(), await gc.new_page()
        logs = []
        for n, p in (("H", H), ("G", G)):
            p.on("console", lambda m, n=n: logs.append(f"{n}:{m.text}") if m.type == "error" else None)
        print("canPlay h264:", await H.evaluate("() => document.createElement('video').canPlayType('video/mp4; codecs=\"avc1.640028\"')") if False else "")
        await H.goto(BASE)
        print("h264 support:", await H.evaluate("() => document.createElement('video').canPlayType('video/mp4; codecs=\"avc1.42E01E\"')"))
        await H.fill('[data-testid="nickname-input"]', "Çağrı")
        await H.click('[data-testid="room-submit-btn"]')
        await H.wait_for_url(re.compile(r"/room/[A-Z0-9]{6}"), timeout=15000)
        await G.goto(H.url)
        await G.fill('[data-testid="invite-nickname-input"]', "Gülşen")
        await G.click('[data-testid="invite-join-btn"]')
        await G.wait_for_selector('[data-testid="room-page"]', timeout=10000)
        if MODE == "link":
            await H.fill('[data-testid="source-url-input"]', MP4)
            await H.click('[data-testid="source-set-btn"]')
        else:
            await H.click('[data-testid="source-tab-upload"]')
            await H.set_input_files('[data-testid="upload-file-input"]', "/app/tests/sample.mp4")
            for _ in range(120):
                t = await H.locator('[data-testid="upload-progress-text"]').inner_text() if await H.locator('[data-testid="upload-progress-text"]').count() else ""
                if "%" not in t and t: break
                await H.wait_for_timeout(500)
            print("upload text:", t)
        await H.wait_for_selector('[data-testid="html-video-player"]', timeout=20000)
        await G.wait_for_selector('[data-testid="html-video-player"]', timeout=20000)
        await H.wait_for_timeout(3000)
        print("loaded H", await H.evaluate(VT), "G", await G.evaluate(VT))
        print("player-error H/G:", await H.locator('[data-testid="player-error"]').count(), await G.locator('[data-testid="player-error"]').count())
        # host presses native play via controls-like JS (user click on video)
        await H.click('[data-testid="html-video-player"]', position={"x": 30, "y": 30})
        await H.wait_for_timeout(300)
        st = await H.evaluate(VT)
        if st and st["paused"]:
            await H.evaluate("() => document.querySelector('[data-testid=html-video-player]').play()")
        for i in range(4):
            await H.wait_for_timeout(1500)
            print(f"play +{(i+1)*1.5}s H", await H.evaluate(VT), "G", await G.evaluate(VT), "tap:", await G.locator('[data-testid="tap-to-sync-btn"]').count())
        if await G.locator('[data-testid="tap-to-sync-btn"]').count():
            await G.click('[data-testid="tap-to-sync-btn"]')
            await G.wait_for_timeout(2500)
            print("after tap H", await H.evaluate(VT), "G", await G.evaluate(VT))
        await H.evaluate("() => { document.querySelector('[data-testid=html-video-player]').currentTime = 1 }")
        await H.wait_for_timeout(3000)
        print("after seek1 H", await H.evaluate(VT), "G", await G.evaluate(VT))
        await H.evaluate("() => document.querySelector('[data-testid=html-video-player]').pause()")
        await H.wait_for_timeout(2500)
        print("after pause H", await H.evaluate(VT), "G", await G.evaluate(VT))
        # play to end
        await H.evaluate("() => { const v=document.querySelector('[data-testid=html-video-player]'); v.currentTime=8; v.play() }")
        await H.wait_for_timeout(5000)
        print("after end H", await H.evaluate(VT), "G", await G.evaluate(VT), "tap:", await G.locator('[data-testid="tap-to-sync-btn"]').count())
        await H.wait_for_timeout(3000)
        print("end+3s H", await H.evaluate(VT), "G", await G.evaluate(VT))
        # host replays from start after end
        await H.evaluate("() => { const v=document.querySelector('[data-testid=html-video-player]'); v.play() }")
        await H.wait_for_timeout(3000)
        print("replay H", await H.evaluate(VT), "G", await G.evaluate(VT))
        await G.screenshot(path=f"/tmp/g_{MODE}.jpg", quality=40, type="jpeg")
        print("ERRLOGS", logs[:10])
        await b.close()

asyncio.run(main())
