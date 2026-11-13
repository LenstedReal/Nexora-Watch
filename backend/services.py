"""Subscription services watched inside the mobile app (beta, "Rave method").

Each person opens the service's own website in the app's in-app browser and signs in with their OWN account; Nexora only
syncs play / pause / seek between room members, like a remote control. Nexora never proxies, downloads, records or reads a
stream and never touches DRM. Only links to a title or a watch page are recognised here; nothing is fetched from the
service (no scraping), so the title is just the service's name.

Turned off with SERVICES_ENABLED=0 (config.py): these hosts are then blocked again like every other subscription platform.
"""
import re
from urllib.parse import urlparse

# id -> display name. Brand colours/letters live in the clients (web ServiceCard, mobile ServicePlayer).
SERVICE_NAMES = {"netflix": "Netflix", "disney": "Disney+", "prime": "Prime Video", "max": "HBO Max"}
SERVICE_CAPS = {"seek": True, "rate_correction": False, "sync": True, "app_only": True}

# Optional locale prefix used by the sites: /tr/, /en-gb/, /tr-en/ ...
_LOCALE = r"(?:/[a-z]{2}(?:-[a-z]{2,4})?)?"

NETFLIX_HOSTS = {"netflix.com", "www.netflix.com", "m.netflix.com"}
NETFLIX_PATH = re.compile(rf"^{_LOCALE}/(watch|title)/(\d{{4,12}})/?$", re.I)

DISNEY_HOSTS = {"disneyplus.com", "www.disneyplus.com", "apps.disneyplus.com"}
# /video/<id>, /tr-tr/video/<id>, /play/<id>, /en-gb/play/<id>; ids are UUIDs or opaque strings.
DISNEY_PATH = re.compile(r"^(?:/[\w-]+)*?/(video|play)/([A-Za-z0-9-]{6,80})/?$")

PRIME_HOSTS = {"primevideo.com", "www.primevideo.com"}
# /detail/<id>/..., /region/eu/detail/<id>, /-/tr/detail/<id>/ref=...
# Title ids: 0 + ~25 upper-case characters, an ASIN (B0 + 8) or amzn1.dv.gti.<uuid>; an optional slug may come first.
PRIME_ID = r"(0[A-Z0-9]{20,30}|B0[A-Z0-9]{8}|amzn1\.dv\.gti\.[0-9a-f-]{36})"
PRIME_PATH = re.compile(rf"^(?:/[\w.-]+)*?/detail/(?:[^/]+/)?{PRIME_ID}(?:/.*)?$")
# amazon.com, amazon.de, amazon.co.uk, amazon.com.tr ... (www. optional)
AMAZON_HOST = re.compile(r"^(?:www\.)?amazon\.(?:[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})$")
AMAZON_PATH = re.compile(rf"^(?:/-/[a-z]{{2}}(?:_[a-z]{{2}})?)?/gp/video/detail/{PRIME_ID}(?:/.*)?$")

# Max was renamed back to HBO Max in 2025; both addresses are accepted.
MAX_WWW = {"max.com", "www.max.com", "hbomax.com", "www.hbomax.com"}
MAX_PLAY = {"play.max.com", "play.hbomax.com"}
MAX_WATCH = re.compile(r"^/video/watch/([\w-]{6,80})(?:/([\w-]{6,80}))?/?$")
MAX_PLAY_PAGE = re.compile(r"^/(show|movie|mini-series|episode|video/watch)/([\w-]{6,80})(?:/([\w-]{6,80}))?/?$")


def _result(service: str, url: str, video_id: str) -> dict:
    return {"service": service, "url": url, "video_id": video_id}


def match(url) -> dict | None:
    """A link to a title / watch page of one of the 4 services -> {service, url (canonical), video_id}; else None."""
    if not isinstance(url, str):
        return None
    try:
        p = urlparse(url.strip())
    except ValueError:
        return None
    if p.scheme not in ("http", "https") or not p.hostname:
        return None
    host = p.hostname.lower()
    path = p.path or "/"
    if host in NETFLIX_HOSTS:
        m = NETFLIX_PATH.match(path)
        return _result("netflix", f"https://www.netflix.com/{m.group(1).lower()}/{m.group(2)}", m.group(2)) if m else None
    if host in DISNEY_HOSTS:
        m = DISNEY_PATH.match(path)
        return _result("disney", f"https://www.disneyplus.com/{m.group(1)}/{m.group(2)}", m.group(2)) if m else None
    if host in PRIME_HOSTS:
        m = PRIME_PATH.match(path)
        return _result("prime", f"https://www.primevideo.com/detail/{m.group(1)}", m.group(1)) if m else None
    if AMAZON_HOST.match(host):
        m = AMAZON_PATH.match(path)
        base = host if host.startswith("www.") else "www." + host
        return _result("prime", f"https://{base}/gp/video/detail/{m.group(1)}", m.group(1)) if m else None
    if host in MAX_WWW:
        m = MAX_WATCH.match(path)
        if not m:
            return None
        play = "play.hbomax.com" if "hbomax" in host else "play.max.com"
        tail = "/".join(x for x in m.groups() if x)
        return _result("max", f"https://{play}/video/watch/{tail}", m.group(1))
    if host in MAX_PLAY:
        m = MAX_PLAY_PAGE.match(path)
        if not m:
            return None
        tail = "/".join(x for x in m.groups()[1:] if x)
        return _result("max", f"https://{host}/{m.group(1)}/{tail}", m.group(2))
    return None


def resolve_service(url) -> dict | None:
    """The room video for a service link, or None when the link is not one."""
    m = match(url)
    if not m:
        return None
    return {"url": m["url"], "kind": "service", "service": m["service"], "video_id": m["video_id"], "title": SERVICE_NAMES[m["service"]],
            "embed_url": None, "stream_url": None, "mime_type": None, "provider": m["service"],
            "capabilities": dict(SERVICE_CAPS), "warning": None}
