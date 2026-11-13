"""Offline tests for the in-app subscription services (services.py). No server, no network:
python3 -m pytest -q tests/test_services.py  (the resolver/policy part needs httpx + python-dotenv and is skipped without them)."""
import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import services  # noqa: E402

CASES = [
    # (link, service, canonical url, id)
    ("https://www.netflix.com/watch/80100172", "netflix", "https://www.netflix.com/watch/80100172", "80100172"),
    ("https://www.netflix.com/watch/80100172?trackId=14170286&t=12", "netflix", "https://www.netflix.com/watch/80100172", "80100172"),
    ("http://netflix.com/title/80057281/", "netflix", "https://www.netflix.com/title/80057281", "80057281"),
    ("https://www.netflix.com/tr/title/80057281", "netflix", "https://www.netflix.com/title/80057281", "80057281"),
    ("https://www.netflix.com/tr-en/watch/81040344", "netflix", "https://www.netflix.com/watch/81040344", "81040344"),
    ("https://www.disneyplus.com/video/0b3c9b8e-2a6f-4c8a-9b0e-7c3e1f6a2d11", "disney",
     "https://www.disneyplus.com/video/0b3c9b8e-2a6f-4c8a-9b0e-7c3e1f6a2d11", "0b3c9b8e-2a6f-4c8a-9b0e-7c3e1f6a2d11"),
    ("https://www.disneyplus.com/tr-tr/video/abc123XYZ", "disney", "https://www.disneyplus.com/video/abc123XYZ", "abc123XYZ"),
    ("https://disneyplus.com/play/9f8e7d6c-5b4a-4321-8765-0fedcba98765?x=1", "disney",
     "https://www.disneyplus.com/play/9f8e7d6c-5b4a-4321-8765-0fedcba98765", "9f8e7d6c-5b4a-4321-8765-0fedcba98765"),
    ("https://www.disneyplus.com/en-gb/play/abcdef12", "disney", "https://www.disneyplus.com/play/abcdef12", "abcdef12"),
    ("https://www.primevideo.com/detail/0KRGHGZCHKS920ZQGY5LBRF7MA/ref=atv_hm_hom_c_1", "prime",
     "https://www.primevideo.com/detail/0KRGHGZCHKS920ZQGY5LBRF7MA", "0KRGHGZCHKS920ZQGY5LBRF7MA"),
    ("https://www.primevideo.com/detail/The-Boys/0KRGHGZCHKS920ZQGY5LBRF7MA/", "prime",
     "https://www.primevideo.com/detail/0KRGHGZCHKS920ZQGY5LBRF7MA", "0KRGHGZCHKS920ZQGY5LBRF7MA"),
    ("https://www.primevideo.com/-/tr/detail/0KRGHGZCHKS920ZQGY5LBRF7MA", "prime",
     "https://www.primevideo.com/detail/0KRGHGZCHKS920ZQGY5LBRF7MA", "0KRGHGZCHKS920ZQGY5LBRF7MA"),
    ("https://www.primevideo.com/region/eu/detail/amzn1.dv.gti.12345678-90ab-cdef-1234-567890abcdef", "prime",
     "https://www.primevideo.com/detail/amzn1.dv.gti.12345678-90ab-cdef-1234-567890abcdef", "amzn1.dv.gti.12345678-90ab-cdef-1234-567890abcdef"),
    ("https://www.amazon.com/gp/video/detail/B08WJP55PR/ref=atv_dp", "prime", "https://www.amazon.com/gp/video/detail/B08WJP55PR", "B08WJP55PR"),
    ("https://amazon.de/gp/video/detail/B08WJP55PR", "prime", "https://www.amazon.de/gp/video/detail/B08WJP55PR", "B08WJP55PR"),
    ("https://www.amazon.co.uk/-/en/gp/video/detail/0KRGHGZCHKS920ZQGY5LBRF7MA", "prime",
     "https://www.amazon.co.uk/gp/video/detail/0KRGHGZCHKS920ZQGY5LBRF7MA", "0KRGHGZCHKS920ZQGY5LBRF7MA"),
    ("https://www.amazon.com.tr/gp/video/detail/B08WJP55PR", "prime", "https://www.amazon.com.tr/gp/video/detail/B08WJP55PR", "B08WJP55PR"),
    ("https://www.max.com/video/watch/1a2b3c4d-1111-2222-3333-444455556666/9z8y7x6w-1111-2222-3333-444455556666", "max",
     "https://play.max.com/video/watch/1a2b3c4d-1111-2222-3333-444455556666/9z8y7x6w-1111-2222-3333-444455556666",
     "1a2b3c4d-1111-2222-3333-444455556666"),
    ("https://play.max.com/video/watch/1a2b3c4d-1111-2222-3333-444455556666/9z8y7x6w-1111-2222-3333-444455556666?x=1", "max",
     "https://play.max.com/video/watch/1a2b3c4d-1111-2222-3333-444455556666/9z8y7x6w-1111-2222-3333-444455556666",
     "1a2b3c4d-1111-2222-3333-444455556666"),
    ("https://play.max.com/show/12345678-aaaa-bbbb-cccc-1234567890ab", "max",
     "https://play.max.com/show/12345678-aaaa-bbbb-cccc-1234567890ab", "12345678-aaaa-bbbb-cccc-1234567890ab"),
    ("https://play.hbomax.com/movie/12345678-aaaa-bbbb-cccc-1234567890ab", "max",
     "https://play.hbomax.com/movie/12345678-aaaa-bbbb-cccc-1234567890ab", "12345678-aaaa-bbbb-cccc-1234567890ab"),
]

NOT_SERVICES = [
    "https://www.netflix.com/", "https://www.netflix.com/browse", "https://www.netflix.com/watch/abc", "https://www.netflix.com/title/",
    "https://netflix.com.evil.example/watch/80100172", "https://evilnetflix.com/watch/80100172", "https://www.netflix.com.tr/watch/80100172",
    "https://www.disneyplus.com/", "https://www.disneyplus.com/tr-tr/home", "https://www.disneyplus.com/video/",
    "https://www.primevideo.com/", "https://www.primevideo.com/detail/Interstellar/", "https://www.primevideo.com/storefront",
    "https://www.amazon.com/dp/B08WJP55PR", "https://www.amazon.evil.com/gp/video/detail/B08WJP55PR", "https://www.amazon.com/gp/video/storefront",
    "https://www.max.com/", "https://play.max.com/", "https://play.max.com/settings", "https://www.max.com/tr/en",
    "ftp://www.netflix.com/watch/80100172", "netflix.com/watch/80100172", "", None, 42,
    "https://www.youtube.com/watch?v=aqz-KE-bpKQ", "https://vimeo.com/76979871",
]


@pytest.mark.parametrize("link,service,url,vid", CASES)
def test_service_links_are_recognised_and_canonical(link, service, url, vid):
    m = services.match(link)
    assert m == {"service": service, "url": url, "video_id": vid}
    v = services.resolve_service(link)
    assert v["kind"] == "service" and v["service"] == service and v["url"] == url and v["video_id"] == vid
    assert v["title"] == services.SERVICE_NAMES[service]
    assert v["capabilities"]["sync"] is True and v["capabilities"]["app_only"] is True
    # Nothing that could be played or framed by a browser: the stream stays inside the service's own page.
    assert v["stream_url"] is None and v["embed_url"] is None and v["mime_type"] is None
    assert services.match(url) == m  # canonical urls are stable


@pytest.mark.parametrize("link", NOT_SERVICES)
def test_other_links_are_not_services(link):
    assert services.match(link) is None and services.resolve_service(link) is None


def test_names():
    assert services.SERVICE_NAMES == {"netflix": "Netflix", "disney": "Disney+", "prime": "Prime Video", "max": "HBO Max"}


def test_capabilities_are_copied_per_video():
    a = services.resolve_service(CASES[0][0])
    a["capabilities"]["sync"] = False
    assert services.resolve_service(CASES[0][0])["capabilities"]["sync"] is True


def _backend():
    pytest.importorskip("httpx")
    pytest.importorskip("dotenv")
    import config
    import policy
    import resolver
    from security import ApiError
    return config, policy, resolver, ApiError


def test_policy_and_resolver_follow_the_flag(monkeypatch):
    config, policy, resolver, ApiError = _backend()
    link = "https://www.netflix.com/watch/80100172?trackId=1"
    monkeypatch.setattr(config, "SERVICES_ENABLED", True)
    policy.check_source(link, None)
    policy.check_source(link, "https://www.netflix.com/browse")  # the page you were on does not matter for a title link
    v = asyncio.run(resolver.resolve(link))
    assert v["kind"] == "service" and v["url"] == "https://www.netflix.com/watch/80100172" and "headers" not in v
    assert policy.public_config()["services_enabled"] is True
    # Still blocked: other pages of the service, and any file "found" on a service page (that would be stream extraction).
    for url, ref in [("https://www.netflix.com/browse", None), ("https://example.com/a.mp4", "https://www.netflix.com/watch/1"),
                     ("https://www.blutv.com/izle/x", None)]:
        with pytest.raises(ApiError) as e:
            policy.check_source(url, ref)
        assert e.value.status == 403 and e.value.code == "drm_not_allowed"

    monkeypatch.setattr(config, "SERVICES_ENABLED", False)
    assert policy.public_config()["services_enabled"] is False
    with pytest.raises(ApiError) as e:
        policy.check_source(link, None)
    assert e.value.code == "drm_not_allowed"
    with pytest.raises(ApiError) as e:  # amazon.de is not on the blocked list: the resolver still refuses it when turned off
        asyncio.run(resolver.resolve("https://www.amazon.de/gp/video/detail/B08WJP55PR"))
    assert e.value.code == "drm_not_allowed"
