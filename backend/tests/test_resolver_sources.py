"""Offline tests of the social-video sources (TikTok, Instagram, X, Facebook): only address recognition, no network.
TikTok short links go through the official oEmbed API; that call is replaced here."""
import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import resolver  # noqa: E402
from security import ApiError  # noqa: E402

SYNC = {"seek": True, "rate_correction": False, "sync": True}
NOSYNC = {"seek": False, "rate_correction": False, "sync": False}


def resolve(url):
    return asyncio.run(resolver.resolve(url))


def code_of(url):
    with pytest.raises(ApiError) as e:
        resolve(url)
    return e.value.code if hasattr(e.value, "code") else e.value.args[1]


@pytest.fixture
def oembed(monkeypatch):
    seen = []

    async def fake(url):
        seen.append(url)
        return "7300000000000000001" if "good" in url else None
    monkeypatch.setattr(resolver, "_tiktok_oembed", fake)
    return seen


@pytest.mark.parametrize("url", [
    "https://www.tiktok.com/@scout2015/video/6718335390845095173",
    "https://tiktok.com/@scout.2015/video/6718335390845095173?is_from_webapp=1&sender_device=pc",
    "https://m.tiktok.com/v/6718335390845095173.html",
    "https://www.tiktok.com/embed/v2/6718335390845095173",
    "https://www.tiktok.com/player/v1/6718335390845095173?autoplay=1",
])
def test_tiktok_video(url):
    v = resolve(url)
    assert (v["kind"], v["video_id"], v["provider"], v["capabilities"]) == ("tiktok", "6718335390845095173", "tiktok", SYNC)
    assert v["embed_url"] == "https://www.tiktok.com/player/v1/6718335390845095173"


def test_tiktok_short_links_use_oembed(oembed):
    for url in ["https://vm.tiktok.com/ZMgood123/", "https://vt.tiktok.com/ZSgood456/", "https://www.tiktok.com/t/ZTgood789/"]:
        v = resolve(url)
        assert (v["kind"], v["video_id"]) == ("tiktok", "7300000000000000001"), url
    assert oembed == ["https://vm.tiktok.com/ZMgood123/", "https://vt.tiktok.com/ZSgood456/", "https://www.tiktok.com/t/ZTgood789/"]
    assert code_of("https://vm.tiktok.com/ZMbad0001/") == "tiktok_short"


def test_tiktok_non_video_pages():
    assert code_of("https://www.tiktok.com/@scout2015") == "social_link"
    for url in ["https://www.tiktok.com.evil.example/@a/video/6718335390845095173", "https://www.tiktok.com/@a/video/123"]:
        try:
            v = resolve(url)
        except ApiError:
            continue
        assert v["kind"] != "tiktok", url


@pytest.mark.parametrize("url,embed", [
    ("https://www.instagram.com/reel/C9xYz12AbCd/", "https://www.instagram.com/reel/C9xYz12AbCd/embed/"),
    ("https://instagram.com/reels/C9xYz12AbCd?igsh=abc", "https://www.instagram.com/reel/C9xYz12AbCd/embed/"),
    ("https://www.instagram.com/p/C9xYz12AbCd/?img_index=1", "https://www.instagram.com/p/C9xYz12AbCd/embed/"),
    ("https://www.instagram.com/someone/p/C9xYz12AbCd/", "https://www.instagram.com/p/C9xYz12AbCd/embed/"),
    ("https://www.instagram.com/tv/C9xYz12AbCd/", "https://www.instagram.com/p/C9xYz12AbCd/embed/"),
    ("https://www.instagram.com/p/C9xYz12AbCd/embed/captioned/", "https://www.instagram.com/p/C9xYz12AbCd/embed/"),
])
def test_instagram(url, embed):
    # 1.6.2: Instagram embeds cannot play in sync for everyone, so the link is refused with a clear reason
    assert code_of(url) == "no_sync_source"


def test_instagram_profile_is_a_clear_error():
    assert code_of("https://www.instagram.com/someone/") == "social_link"
    assert code_of("https://www.instagram.com/stories/someone/3300000000000000000/") == "social_link"


@pytest.mark.parametrize("url", [
    "https://x.com/NASA/status/1790000000000000000",
    "https://twitter.com/NASA/status/1790000000000000000?s=20",
    "https://mobile.twitter.com/NASA/status/1790000000000000000/video/1",
    "https://x.com/i/web/status/1790000000000000000",
    "https://platform.twitter.com/embed/Tweet.html?id=1790000000000000000",
])
def test_x(url):
    # 1.6.2: X embeds cannot play in sync, refused
    assert code_of(url) == "no_sync_source"


def test_x_profile_is_a_clear_error():
    assert code_of("https://x.com/NASA") == "social_link"


@pytest.mark.parametrize("url,href", [
    ("https://www.facebook.com/watch/?v=1234567890123456", "https://www.facebook.com/watch/?v=1234567890123456"),
    ("https://m.facebook.com/watch?v=1234567890123456&ref=sharing", "https://www.facebook.com/watch/?v=1234567890123456"),
    ("https://www.facebook.com/video.php?v=1234567890123456", "https://www.facebook.com/watch/?v=1234567890123456"),
    ("https://www.facebook.com/NASA/videos/1234567890123456/", "https://www.facebook.com/NASA/videos/1234567890123456/"),
    ("https://web.facebook.com/NASA/videos/launch-day/1234567890123456", "https://www.facebook.com/NASA/videos/1234567890123456/"),
    ("https://www.facebook.com/reel/1234567890123456", "https://www.facebook.com/reel/1234567890123456"),
])
def test_facebook(url, href):
    v = resolve(url)
    assert (v["kind"], v["video_id"], v["href"], v["capabilities"]) == ("facebook", "1234567890123456", href, SYNC)
    assert v["embed_url"].startswith("https://www.facebook.com/plugins/video.php?href=")


def test_facebook_short_links_and_pages():
    for url in ["https://fb.watch/abcDEF123/", "https://www.facebook.com/share/v/1AbCdEfGh/", "https://www.facebook.com/share/r/1AbCdEfGh/"]:
        assert code_of(url) == "fb_short", url
    assert code_of("https://www.facebook.com/NASA") == "social_link"


def test_vimeo_still_resolves_when_pasted():
    assert resolve("https://vimeo.com/76979871")["kind"] == "vimeo"


def test_lists_offer_the_new_sites():
    import config
    import policy
    doms = [s["domain"] for s in config.ALLOWED_SITES]
    if os.environ.get("ALLOWED_SITES"):
        pytest.skip("ALLOWED_SITES is set in the environment")
    for d in ("tiktok.com", "facebook.com"):
        assert d in doms
    for d in ("vimeo.com", "archive.org", "instagram.com", "x.com", "kick.com"):
        assert d not in doms
    # still accepted as a page picked in the app's browser
    assert policy.is_allowed_site("vimeo.com") and policy.is_allowed_site("www.twitter.com") and policy.is_allowed_site("vm.tiktok.com")
