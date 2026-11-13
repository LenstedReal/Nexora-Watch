import asyncio
import ipaddress
import re
import socket
import json
import time
from urllib.parse import parse_qsl, quote, unquote, urlencode, urlparse, urlunparse

import httpx

from security import ApiError
import config
import services

YT_RE = re.compile(r"(?:youtube\.com/(?:watch\?(?:.*&)?v=|embed/|shorts/|live/)|youtu\.be/|youtube-nocookie\.com/embed/)([\w-]{11})")
DRIVE_RE = re.compile(r"drive\.google\.com/(?:file/d/|open\?id=|uc\?(?:.*&)?id=)([\w-]{20,})")
DIRECT_EXT = re.compile(r"\.(mp4|webm|mov|m4v)(?:$|[?#])", re.I)
HLS_EXT = re.compile(r"\.m3u8(?:$|[?#])", re.I)

FULL_CAPS = {"seek": True, "rate_correction": True, "sync": True}
# Official embedded players (YouTube, Vimeo, Twitch, TikTok, Facebook): position sync by seeking, no playback-rate nudging.
EMBED_CAPS = {"seek": True, "rate_correction": False, "sync": True}
LIVE_CAPS = {"seek": False, "rate_correction": False, "sync": False}
# Embeds without a JavaScript API (Instagram, X): everyone sees the same post, nobody can be kept in sync.
NOSYNC_CAPS = LIVE_CAPS

# --- Vimeo: official Player SDK (https://github.com/vimeo/player.js). Only URL shapes that carry the numeric id. -------
VIMEO_HOSTS = {"vimeo.com", "www.vimeo.com", "player.vimeo.com"}
VIMEO_PATH = re.compile(
    r"^/(?:video/|channels/[\w-]+/|groups/[\w-]+/videos/|album/\d+/video/|showcase/\d+/video/)?(\d{6,12})(?:/([0-9a-f]{6,16}))?/?$", re.I)
VIMEO_HASH = re.compile(r"^[0-9a-f]{6,16}$", re.I)

# --- Twitch: official interactive embed (https://dev.twitch.tv/docs/embed/video-and-clips/). ----------------------------
TWITCH_HOSTS = {"twitch.tv", "www.twitch.tv", "m.twitch.tv", "go.twitch.tv"}
TWITCH_VOD = re.compile(r"^/(?:videos|([A-Za-z0-9_]{3,25})/(?:v|video))/(\d{6,12})/?$")
TWITCH_CHANNEL = re.compile(r"^/([A-Za-z0-9][A-Za-z0-9_]{2,24})/?$")
TWITCH_CLIP = re.compile(r"^/[A-Za-z0-9_]{3,25}/clip/[\w-]+/?$")
# First path segments that are pages of the site, not channels.
TWITCH_RESERVED = {"directory", "videos", "settings", "downloads", "search", "subscriptions", "wallet", "turbo", "store", "jobs",
                   "privacy", "legal", "about", "friends", "inventory", "drops", "prime", "team", "teams", "user", "collections",
                   "popout", "moderator", "embed", "login", "signup", "following", "broadcast", "partner", "creatorcamp", "bits",
                   "payments", "messages", "activate", "annual-recap", "events", "clips", "category", "security", "safety", "ads"}

# --- Kick: official live embed, an iframe of player.kick.com/<channel>
# (https://help.kick.com/en/articles/8010826-how-to-embed-your-kick-livestream). It has no documented JS control, so a
# channel plays live for everyone without sync. Past broadcasts and clips have no documented embed at all.
KICK_HOSTS = {"kick.com", "www.kick.com", "m.kick.com"}
KICK_CHANNEL = re.compile(r"^/([A-Za-z0-9][A-Za-z0-9_-]{2,39})/?$")
KICK_RECORDED = re.compile(r"^/(?:video/[\w-]+|[A-Za-z0-9][A-Za-z0-9_-]{2,39}/(?:videos?|clips?)/[\w-]+)/?$")
KICK_RESERVED = {"browse", "categories", "category", "following", "dashboard", "video", "videos", "clips", "search", "settings",
                 "about", "terms-of-service", "privacy-policy", "community-guidelines", "dmca-policy", "careers", "help",
                 "login", "signup", "auth", "api", "popout", "transactions", "subscriptions", "messages", "creator-program",
                 "leaderboards", "emotes", "store", "download", "apps", "mobile", "contact", "partners", "security"}

# --- Internet Archive: a details page becomes one of its video files, chosen from the item's metadata
# (https://archive.org/developers/md-read.html). Files are linked as archive.org/download/<id>/<file>: "A particular
# file can always be downloaded from" there, while the data server it redirects to "is not a permalink"
# (https://archive.org/developers/items.html).
IA_HOSTS = {"archive.org", "www.archive.org"}
IA_PAGE = re.compile(r"^/(?:details|embed)/([A-Za-z0-9][A-Za-z0-9._-]{0,99})(?:/(.+?))?/?$")
IA_VIDEO = re.compile(r"\.(mp4|m4v|webm|mov)$", re.I)
# Browser-friendly first: the archive's own H.264 copies, then MPEG-4 originals, then anything else that is a video file.
IA_FORMATS = ["h.264", "h.264 hd", "mpeg4", "h.264 ia", "512kb mpeg4", "webm"]
IA_MAX_METADATA = 4 * 1024 * 1024

# --- Dropbox: a share link becomes a direct file with raw=1 (https://help.dropbox.com/share/force-download). -----------
DROPBOX_HOSTS = {"dropbox.com", "www.dropbox.com"}
DROPBOX_PATH = re.compile(r"^/(?:s|scl/fi)/[^/]+/[^/]+", re.I)

# --- TikTok: official Embed Player, an iframe of www.tiktok.com/player/v1/<id> driven by postMessage (play / pause /
# seekTo, onCurrentTime / onStateChange events: https://developers.tiktok.com/doc/embed-player). Short share links
# (vm./vt.tiktok.com, tiktok.com/t/...) are looked up with the official oEmbed API (https://developers.tiktok.com/doc/embed-videos).
TIKTOK_HOSTS = {"tiktok.com", "www.tiktok.com", "m.tiktok.com"}
TIKTOK_SHORT_HOSTS = {"vm.tiktok.com", "vt.tiktok.com"}
TIKTOK_PATH = re.compile(r"^/(?:@[\w.-]{1,40}/(?:video|photo)/|embed/(?:v2/)?|player/v1/|v/)(\d{15,21})(?:\.html)?/?$")
TIKTOK_SHORT_PATH = re.compile(r"^/(?:t/)?[A-Za-z0-9]{5,20}/?$")
TIKTOK_OEMBED = "https://www.tiktok.com/oembed?url="
TIKTOK_ID = re.compile(r"^\d{15,21}$")

# --- Instagram: official post / reel embed (www.instagram.com/p/<code>/embed). No JavaScript control: no sync. ---------
IG_HOSTS = {"instagram.com", "www.instagram.com", "m.instagram.com"}
IG_PATH = re.compile(r"^/(?:[A-Za-z0-9_.]{1,30}/)?(p|reels?|tv)/([A-Za-z0-9_-]{5,40})(?:/embed(?:/captioned)?)?/?$")

# --- X / Twitter: official embedded post (platform.twitter.com/embed/Tweet.html?id=<id>). No sync. ---------------------
X_HOSTS = {"x.com", "www.x.com", "mobile.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com", "m.twitter.com"}
X_PATH = re.compile(r"^/(?:[A-Za-z0-9_]{1,15}|i(?:/web)?)/status(?:es)?/(\d{5,20})(?:/(?:video|photo)/\d)?/?$")

# --- Facebook: official Embedded Video Player (https://developers.facebook.com/docs/plugins/embedded-video-player/api):
# the JS SDK's fb-video with play / pause / seek / getCurrentPosition and events. fb.watch and /share/ short links can
# only be opened by following Facebook's redirect, which is not an official API: the full link is asked for instead.
FB_HOSTS = {"facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com", "mbasic.facebook.com"}
FB_SHORT_HOSTS = {"fb.watch", "www.fb.watch"}
FB_WATCH_PATHS = {"/watch", "/watch/", "/video.php", "/video/video.php", "/watch/live", "/watch/live/"}
FB_VIDEOS = re.compile(r"^/([A-Za-z0-9.\-]{1,80})/videos/(?:[^/]{1,200}/)?(\d{6,20})/?$")
FB_REEL = re.compile(r"^/reel/(\d{6,20})/?$")
FB_SHARE = re.compile(r"^/share/(?:v|r)/[A-Za-z0-9]{4,30}/?$")


async def _assert_public(host: str):
    if not host or host.lower() in {"localhost", "metadata.google.internal"}:
        raise ApiError(400, "invalid_url", "Bu adres kullanılamaz")
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(host, None)
    except socket.gaierror:
        raise ApiError(422, "network", "Sunucu adı çözümlenemedi")
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise ApiError(400, "invalid_url", "Özel ağ adresleri desteklenmez")


async def _guard(request: httpx.Request):
    await _assert_public(request.url.host)


async def _probe(url: str, referer: str | None = None) -> dict:
    headers = {"Range": "bytes=0-2047", "User-Agent": "NexoraWatch/1.0"}
    if referer:
        headers["Referer"] = referer
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=8, max_redirects=5, event_hooks={"request": [_guard]}) as c:
            async with c.stream("GET", url, headers=headers) as r:
                head = b""
                async for chunk in r.aiter_bytes():
                    head += chunk
                    if len(head) >= 2048:
                        break
                return {"status": r.status_code, "ctype": r.headers.get("content-type", "").split(";")[0].lower(),
                        "headers": r.headers, "head": head[:2048], "final_url": str(r.url)}
    except ApiError:
        raise
    except httpx.TimeoutException:
        raise ApiError(422, "network", "Kaynak zaman aşımına uğradı")
    except httpx.HTTPError:
        raise ApiError(422, "network", "Kaynağa ulaşılamadı")


def _http_errors(p: dict):
    s = p["status"]
    if s in (401, 403):
        raise ApiError(422, "forbidden", f"Kaynak erişim izni vermiyor (HTTP {s})")
    if s in (404, 410):
        raise ApiError(422, "not_found", f"Kaynak bulunamadı (HTTP {s})")
    if s >= 400:
        raise ApiError(422, "http_error", f"Kaynak hata döndürdü (HTTP {s})")


def _classify(url: str, p: dict, provider: str) -> dict | None:
    head = p["head"].lstrip()
    if head.startswith(b"#EXTM3U") or "mpegurl" in p["ctype"]:
        if not head.startswith(b"#EXTM3U"):
            raise ApiError(422, "manifest_invalid", "HLS manifesti geçersiz")
        return {"kind": "hls", "stream_url": p["final_url"], "mime_type": "application/vnd.apple.mpegurl",
                "provider": provider, "capabilities": FULL_CAPS, "range_support": None}
    is_video = p["ctype"].startswith("video/") or (p["ctype"] in ("application/octet-stream", "binary/octet-stream") and DIRECT_EXT.search(url))
    if is_video:
        ranged = p["status"] == 206 or p["headers"].get("accept-ranges", "").lower() == "bytes"
        total = None
        cr = p["headers"].get("content-range", "")
        if "/" in cr and cr.rsplit("/", 1)[1].isdigit():
            total = int(cr.rsplit("/", 1)[1])
        return {"kind": "direct", "stream_url": p["final_url"], "mime_type": p["ctype"] or "video/mp4", "provider": provider,
                "capabilities": {**FULL_CAPS, "seek": ranged}, "range_support": ranged, "size": total,
                "warning": None if ranged else "Sunucu HTTP Range desteklemiyor; ileri/geri sarma güvenilir olmayabilir",
                "warning_code": None if ranged else "no_range"}
    return None


def _vimeo(url: str, parsed) -> dict | None:
    """A Vimeo video page / player URL -> the official player. Other vimeo.com pages are not videos (None)."""
    if (parsed.hostname or "").lower() not in VIMEO_HOSTS:
        return None
    m = VIMEO_PATH.match(parsed.path or "")
    if not m:
        return None
    vid, h = m.group(1), m.group(2)
    if not h:  # unlisted videos carry their key as /<id>/<hash> or ?h=<hash>
        q = dict(parse_qsl(parsed.query))
        h = q.get("h") if VIMEO_HASH.match(q.get("h", "")) else None
    embed = f"https://player.vimeo.com/video/{vid}" + (f"?h={h}" if h else "")
    return {"url": url, "kind": "vimeo", "video_id": vid, "video_hash": h, "embed_url": embed, "stream_url": None,
            "title": "Vimeo", "mime_type": None, "provider": "vimeo", "capabilities": EMBED_CAPS, "warning": None}


def _twitch(url: str, parsed) -> dict | None:
    """A Twitch past broadcast (synced) or live channel (everyone watches live) -> the official player."""
    host = (parsed.hostname or "").lower()
    path = parsed.path or ""
    if host == "clips.twitch.tv" or (host in TWITCH_HOSTS and TWITCH_CLIP.match(path)):
        # Clips have no interactive embed (no position API), so they cannot be kept in sync.
        raise ApiError(422, "twitch_clip", "Twitch klipleri eşitlenemiyor; yayının ya da kayıtlı videonun bağlantısını kullan")
    vid = channel = owner = None  # owner = the channel name as written in the address, for the title
    if host == "player.twitch.tv":
        q = dict(parse_qsl(parsed.query))
        v = q.get("video", "")
        if re.fullmatch(r"v?\d{6,12}", v):
            vid = v.lstrip("v")
        elif re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_]{2,24}", q.get("channel", "")):
            owner = q["channel"]
            channel = owner.lower()
        else:
            return None
    elif host in TWITCH_HOSTS:
        m = TWITCH_VOD.match(path)
        if m:
            owner, vid = m.group(1), m.group(2)
        else:
            c = TWITCH_CHANNEL.match(path)
            if not c or c.group(1).lower() in TWITCH_RESERVED:
                return None
            owner = c.group(1)
            channel = owner.lower()
    else:
        return None
    base = {"url": url, "kind": "twitch", "stream_url": None, "mime_type": None, "provider": "twitch", "warning": None}
    if vid:
        return {**base, "video_id": vid, "channel": None, "live": False, "embed_url": f"https://player.twitch.tv/?video=v{vid}",
                "title": f"Twitch · {owner}" if owner else "Twitch", "capabilities": EMBED_CAPS}
    return {**base, "video_id": None, "channel": channel, "live": True, "embed_url": f"https://player.twitch.tv/?channel={channel}",
            "title": f"Twitch · {owner}", "capabilities": LIVE_CAPS}


def _kick(url: str, parsed) -> dict | None:
    """A Kick channel -> Kick's own live embed (no sync). Recorded videos and clips cannot be embedded officially."""
    host = (parsed.hostname or "").lower()
    path = parsed.path or ""
    if host not in KICK_HOSTS and host != "player.kick.com":
        return None
    if host in KICK_HOSTS and (KICK_RECORDED.match(path) or "clip" in dict(parse_qsl(parsed.query))):
        raise ApiError(422, "kick_recorded", "Kick kayıtlı yayınları ve klipleri resmî oynatıcıyla gömülemiyor; kanalın canlı yayın bağlantısını kullan")
    m = KICK_CHANNEL.match(path)
    if not m or (host in KICK_HOSTS and m.group(1).lower() in KICK_RESERVED):
        return None
    channel = m.group(1).lower()
    return {"url": url, "kind": "kick", "video_id": None, "channel": channel, "live": True,
            "embed_url": f"https://player.kick.com/{channel}", "stream_url": None, "mime_type": None, "provider": "kick",
            "title": f"Kick · {m.group(1)}", "capabilities": LIVE_CAPS, "warning": None}



def _embed_base(url: str, kind: str) -> dict:
    return {"url": url, "kind": kind, "stream_url": None, "mime_type": None, "provider": kind, "warning": None}


async def _tiktok_oembed(url: str) -> str | None:
    """The numeric id of a TikTok short link, through the official oEmbed API. None when it cannot be found out."""
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=8, max_redirects=3, event_hooks={"request": [_guard]}) as c:
            r = await c.get(TIKTOK_OEMBED + quote(url, safe=""), headers={"User-Agent": "NexoraWatch/1.0", "Accept": "application/json"})
            if r.status_code >= 400 or len(r.content) > 256 * 1024:
                return None
            data = r.json()
    except (ApiError, httpx.HTTPError, ValueError):
        return None
    if not isinstance(data, dict):
        return None
    vid = str(data.get("embed_product_id") or "")
    if not TIKTOK_ID.match(vid):
        m = re.search(r'data-video-id="(\d{15,21})"', str(data.get("html") or ""))
        vid = m.group(1) if m else ""
    return vid or None


async def _tiktok(url: str, parsed) -> dict | None:
    """A TikTok video (or a short share link to one) -> the official Embed Player (synced)."""
    host = (parsed.hostname or "").lower()
    path = parsed.path or ""
    vid = None
    if host in TIKTOK_HOSTS:
        m = TIKTOK_PATH.match(path)
        if m:
            vid = m.group(1)
        elif path.startswith("/t/") and TIKTOK_SHORT_PATH.match(path):
            vid = await _tiktok_oembed(url)
            if not vid:
                raise ApiError(422, "tiktok_short", "TikTok kısa bağlantısı açılamadı; videoyu TikTok'ta açıp tam bağlantısını kopyala")
        elif path.startswith("/@"):
            raise ApiError(422, "social_link", "Bu bağlantıda tek bir video yok; videonun kendi bağlantısını kopyala")
        else:
            return None
    elif host in TIKTOK_SHORT_HOSTS:
        if not TIKTOK_SHORT_PATH.match(path):
            return None
        vid = await _tiktok_oembed(url)
        if not vid:
            raise ApiError(422, "tiktok_short", "TikTok kısa bağlantısı açılamadı; videoyu TikTok'ta açıp tam bağlantısını kopyala")
    else:
        return None
    return {**_embed_base(url, "tiktok"), "video_id": vid, "embed_url": f"https://www.tiktok.com/player/v1/{vid}",
            "title": "TikTok", "capabilities": EMBED_CAPS}


def _instagram(url: str, parsed) -> dict | None:
    """An Instagram post or reel -> Instagram's own embed (no JavaScript control, no sync)."""
    if (parsed.hostname or "").lower() not in IG_HOSTS:
        return None
    m = IG_PATH.match(parsed.path or "")
    if not m:
        if (parsed.path or "/") not in ("", "/"):
            raise ApiError(422, "social_link", "Bu bağlantıda tek bir video yok; gönderinin ya da Reels videosunun bağlantısını kopyala")
        return None
    kind, code = m.group(1), m.group(2)
    seg = "reel" if kind.startswith("reel") else "p"
    return {**_embed_base(url, "instagram"), "video_id": code, "embed_url": f"https://www.instagram.com/{seg}/{code}/embed/",
            "title": "Instagram", "capabilities": NOSYNC_CAPS}


def _x(url: str, parsed) -> dict | None:
    """An X (Twitter) post -> the official embedded post (no sync)."""
    host = (parsed.hostname or "").lower()
    vid = None
    if host == "platform.twitter.com" and (parsed.path or "").rstrip("/") in ("/embed/Tweet.html", "/embed/index.html"):
        v = dict(parse_qsl(parsed.query)).get("id", "")
        vid = v if re.fullmatch(r"\d{5,20}", v) else None
        if not vid:
            return None
    elif host in X_HOSTS:
        m = X_PATH.match(parsed.path or "")
        if not m:
            if (parsed.path or "/") not in ("", "/"):
                raise ApiError(422, "social_link", "Bu bağlantıda tek bir gönderi yok; gönderinin kendi bağlantısını kopyala")
            return None
        vid = m.group(1)
    else:
        return None
    return {**_embed_base(url, "x"), "video_id": vid, "embed_url": f"https://platform.twitter.com/embed/Tweet.html?id={vid}",
            "title": "X", "capabilities": NOSYNC_CAPS}


def _facebook(url: str, parsed) -> dict | None:
    """A Facebook video / reel -> the official Embedded Video Player (synced through its JS API)."""
    host = (parsed.hostname or "").lower()
    path = parsed.path or ""
    if host in FB_SHORT_HOSTS or (host in FB_HOSTS and FB_SHARE.match(path)):
        raise ApiError(422, "fb_short", "Facebook kısa bağlantıları açılamıyor; videoyu Facebook'ta açıp tam bağlantısını kopyala")
    if host not in FB_HOSTS:
        return None
    vid = href = None
    if path in FB_WATCH_PATHS:
        v = dict(parse_qsl(parsed.query)).get("v", "")
        if re.fullmatch(r"\d{6,20}", v):
            vid, href = v, f"https://www.facebook.com/watch/?v={v}"
    elif FB_VIDEOS.match(path):
        m = FB_VIDEOS.match(path)
        vid, href = m.group(2), f"https://www.facebook.com/{m.group(1)}/videos/{m.group(2)}/"
    elif FB_REEL.match(path):
        vid = FB_REEL.match(path).group(1)
        href = f"https://www.facebook.com/reel/{vid}"
    if not vid:
        if path not in ("", "/"):
            raise ApiError(422, "social_link", "Bu bağlantıda tek bir video yok; videonun kendi bağlantısını kopyala")
        return None
    return {**_embed_base(url, "facebook"), "video_id": vid, "href": href,
            "embed_url": "https://www.facebook.com/plugins/video.php?" + urlencode({"href": href, "show_text": "false"}),
            "title": "Facebook", "capabilities": EMBED_CAPS}

async def _ia_metadata(identifier: str) -> dict:
    """The item's public metadata (MD Read API). Size-capped; an unknown item comes back empty."""
    url = f"https://archive.org/metadata/{quote(identifier)}"
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=8, max_redirects=3, event_hooks={"request": [_guard]}) as c:
            async with c.stream("GET", url, headers={"User-Agent": "NexoraWatch/1.0", "Accept": "application/json"}) as r:
                if r.status_code >= 400:
                    _http_errors({"status": r.status_code})
                body = b""
                async for chunk in r.aiter_bytes():
                    body += chunk
                    if len(body) > IA_MAX_METADATA:
                        raise ApiError(422, "archive_no_video", "Internet Archive öğesi çok büyük; videonun kendi indirme bağlantısını kullan")
    except ApiError:
        raise
    except httpx.TimeoutException:
        raise ApiError(422, "network", "Internet Archive zaman aşımına uğradı")
    except httpx.HTTPError:
        raise ApiError(422, "network", "Internet Archive'a ulaşılamadı")
    try:
        data = json.loads(body or b"{}")
    except ValueError:
        raise ApiError(422, "network", "Internet Archive geçersiz yanıt verdi")
    return data if isinstance(data, dict) else {}


def _ia_pick(files: list, wanted: str | None) -> str | None:
    """Name of the file to play: the one in the address if it is a video, else the most browser-friendly video file."""
    videos = [f for f in files if isinstance(f, dict) and isinstance(f.get("name"), str) and IA_VIDEO.search(f["name"])
              and str(f.get("private", "")).lower() != "true"]
    if wanted:
        for f in videos:
            if f["name"] == wanted:
                return f["name"]

    def rank(f):
        fmt = str(f.get("format", "")).strip().lower()
        r = IA_FORMATS.index(fmt) if fmt in IA_FORMATS else len(IA_FORMATS) + (1 if f["name"].lower().endswith(".mov") else 0)
        return (r, f["name"])
    return min(videos, key=rank)["name"] if videos else None


async def _archive(url: str, parsed, referer: str | None) -> dict | None:
    if (parsed.hostname or "").lower() not in IA_HOSTS:
        return None
    m = IA_PAGE.match(parsed.path or "")
    if not m:
        return None
    ident, wanted = m.group(1), unquote(m.group(2) or "") or None
    meta = await _ia_metadata(ident)
    if not meta or meta.get("error"):
        raise ApiError(422, "not_found", "Internet Archive öğesi bulunamadı")
    name = None if meta.get("is_dark") else _ia_pick(meta.get("files") or [], wanted)
    if not name:
        raise ApiError(422, "archive_no_video", "Bu Internet Archive sayfasında oynatılabilir video dosyası yok")
    dl = f"https://archive.org/download/{quote(ident)}/{quote(name)}"
    p = await _probe(dl, referer)
    _http_errors(p)
    c = _classify(dl, p, "archive.org")
    if not c or c["kind"] != "direct":
        raise ApiError(422, "archive_no_video", "Bu Internet Archive sayfasında oynatılabilir video dosyası yok")
    c["stream_url"] = dl
    title = (meta.get("metadata") or {}).get("title")
    if isinstance(title, list):
        title = next((x for x in title if isinstance(x, str)), None)
    title = (title.strip() if isinstance(title, str) else "")[:120] or name.rsplit("/", 1)[-1][:120]
    return {"url": url, "video_id": ident, "embed_url": None, "title": title, "warning": None, **c}


def _dropbox_raw(parsed) -> str | None:
    """Dropbox share link of ONE file -> the same link with raw=1, which Dropbox serves as the file itself."""
    if (parsed.hostname or "").lower() not in DROPBOX_HOSTS or not DROPBOX_PATH.match(parsed.path or ""):
        return None
    q = [(k, v) for k, v in parse_qsl(parsed.query, keep_blank_values=True) if k.lower() not in ("dl", "raw")]
    return urlunparse(("https", "www.dropbox.com", parsed.path, "", urlencode(q + [("raw", "1")]), ""))


def _clean_referer(referer_in) -> str | None:
    if referer_in in (None, ""):
        return None
    ref = referer_in.strip() if isinstance(referer_in, str) else ""
    p = urlparse(ref)
    if not ref or len(ref) > 2000 or p.scheme not in ("http", "https") or not p.hostname:
        raise ApiError(400, "invalid_referer", "Geçersiz kaynak sayfa adresi (referer)")
    return ref


def _clean_title(title_in) -> str | None:
    t = title_in.strip() if isinstance(title_in, str) else ""
    return t[:120] or None


# --- Titles of official players -------------------------------------------------------------------------------------
# The client sends the page title it saw (document.title), which on these sites is often just "YouTube" or "KICK", or
# carries a site suffix. The real video title comes from the providers' official oEmbed endpoints
# (https://oembed.com, https://www.youtube.com/oembed, https://developer.vimeo.com/api/oembed/videos); live channels
# are named after the channel. A failed lookup never fails the resolve: it falls back to a neat provider label.
PROVIDER_LABELS = {"youtube": "YouTube", "vimeo": "Vimeo", "twitch": "Twitch", "kick": "Kick"}
GENERIC_TITLES = {"youtube", "youtube music", "youtube shorts", "shorts", "vimeo", "twitch", "kick", "google drive", "drive",
                  "video", "videos", "watch", "live", "home", "videos & movies", "videos & movies on vimeo"}
TITLE_PREFIX = re.compile(r"^\(\d+\+?\)\s*")  # "(3) Video - YouTube": unread-notification counter
TITLE_SUFFIX = re.compile(r"\s*(?:[-–—|·:]\s*(?:youtube(?: music)?|vimeo|twitch|kick)|\bon vimeo|[-–—|·]\s*videos?\s*&\s*movies)\s*$", re.I)
OEMBED_TIMEOUT = 2.5
OEMBED_MAX = 64 * 1024
_title_cache: dict = {}  # key -> (expires at, title or None); failures are remembered briefly so they are not retried at once
TITLE_CACHE_MAX = 2000


def _page_title(t: str | None) -> str | None:
    """A page title without counters and site suffixes, or None when nothing but the site's name is left."""
    if not t:
        return None
    t = TITLE_PREFIX.sub("", t)
    for _ in range(3):
        t2 = TITLE_SUFFIX.sub("", t).strip()
        if t2 == t:
            break
        t = t2
    return None if t.strip().lower() in GENERIC_TITLES else (t.strip()[:120] or None)


async def _fetch_oembed(url: str):
    """GET an oEmbed document (fixed provider hosts, no redirects, size-capped). Tests replace `oembed_fetch`."""
    async with httpx.AsyncClient(timeout=OEMBED_TIMEOUT, follow_redirects=False) as c:
        async with c.stream("GET", url, headers={"User-Agent": "NexoraWatch/1.0", "Accept": "application/json"}) as r:
            if r.status_code != 200:
                return None
            body = b""
            async for chunk in r.aiter_bytes():
                body += chunk
                if len(body) > OEMBED_MAX:
                    return None
    return json.loads(body)


oembed_fetch = _fetch_oembed


async def _oembed_title(key: str, url: str) -> str | None:
    now = time.monotonic()
    hit = _title_cache.get(key)
    if hit and hit[0] > now:
        return hit[1]
    try:
        data = await asyncio.wait_for(oembed_fetch(url), OEMBED_TIMEOUT + 0.5)
    except Exception:  # network, timeout, bad JSON: the title is a nicety, never a reason to fail
        data = None
    raw = data.get("title") if isinstance(data, dict) else None
    t = " ".join(raw.split())[:120] if isinstance(raw, str) else ""
    t = t if t and t.lower() not in GENERIC_TITLES else None
    _title_cache.pop(key, None)
    _title_cache[key] = (now + (86400 if t else 300), t)
    while len(_title_cache) > TITLE_CACHE_MAX:
        _title_cache.pop(next(iter(_title_cache)))
    return t


async def _provider_title(res: dict, page_title: str | None) -> str:
    kind = res["kind"]
    label = PROVIDER_LABELS[kind]
    if kind == "youtube":
        watch = f"https://www.youtube.com/watch?v={res['video_id']}"
        t = await _oembed_title(f"yt:{res['video_id']}", f"https://www.youtube.com/oembed?url={quote(watch, safe='')}&format=json")
        return t or _page_title(page_title) or label
    if kind == "vimeo":
        page = f"https://vimeo.com/{res['video_id']}" + (f"/{res['video_hash']}" if res.get("video_hash") else "")
        t = await _oembed_title(f"vimeo:{res['video_id']}:{res.get('video_hash') or ''}",
                                f"https://vimeo.com/api/oembed.json?url={quote(page, safe='')}")
        return t or _page_title(page_title) or label
    if res.get("title") and res["title"] != label:  # Twitch / Kick: "Twitch · <channel>"
        return res["title"]
    p = _page_title(page_title)
    return f"{label} · {p}" if p else label


async def resolve(url_in, referer=None, title=None) -> dict:
    ref = _clean_referer(referer)
    custom_title = _clean_title(title)
    res = await _resolve(url_in, ref)
    # Nexora is a watch-together app: a source that cannot play at the same moment for everyone is not offered.
    if (res.get("capabilities") or {}).get("sync") is False:
        kind = res.get("kind")
        if kind == "twitch":
            raise ApiError(422, "twitch_live", "Twitch canlı yayınları eşitlenemiyor; kayıtlı yayın bağlantısı paylaş")
        if kind == "drive_embed":
            raise ApiError(422, "drive_no_stream", "Drive bu dosyayı akış olarak sunmuyor; dosyayı indirip Videoyu yükle ile ekle")
        raise ApiError(422, "no_sync_source", "Bu kaynak herkeste aynı anda oynatılamıyor, bu yüzden desteklenmiyor")
    if res.get("kind") in PROVIDER_LABELS:
        res["title"] = await _provider_title(res, custom_title)
    elif custom_title:
        res["title"] = custom_title
    if ref and res.get("kind") in ("direct", "hls"):
        res["headers"] = {"Referer": ref}
    return res


async def _resolve(url_in, referer: str | None) -> dict:
    url = url_in.strip() if isinstance(url_in, str) else ""
    if not url or len(url) > 4000:
        raise ApiError(400, "invalid_url", "Geçerli bir video adresi gerekli")
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ApiError(400, "invalid_url", "Adres http(s) ile başlamalı")

    svc = services.resolve_service(url)  # rave worker: in-app subscription services (beta)
    if svc:
        if not config.SERVICES_ENABLED:
            raise ApiError(403, "drm_not_allowed", "Telif korumalı/abonelikli platformlardan içerik paylaşılamaz")
        return svc

    yt = YT_RE.search(url)
    if yt:
        vid = yt.group(1)
        return {"url": url, "kind": "youtube", "video_id": vid, "embed_url": f"https://www.youtube.com/embed/{vid}",
                "stream_url": None, "title": "YouTube", "mime_type": None, "provider": "youtube",
                "capabilities": {"seek": True, "rate_correction": False, "sync": True}, "warning": None}

    official = (_vimeo(url, parsed) or _twitch(url, parsed) or _kick(url, parsed) or _instagram(url, parsed) or _x(url, parsed)
                or _facebook(url, parsed) or await _tiktok(url, parsed))
    if official:
        return official

    drive = DRIVE_RE.search(url)
    if drive:
        fid = drive.group(1)
        direct = f"https://drive.google.com/uc?export=download&id={fid}"
        try:
            p = await _probe(direct, referer)
            if p["status"] < 400:
                c = _classify(direct, p, "drive")
                if c:
                    return {"url": url, "video_id": fid, "embed_url": None, "title": "Google Drive", **c}
        except ApiError:
            pass
        return {"url": url, "kind": "drive_embed", "video_id": fid, "embed_url": f"https://drive.google.com/file/d/{fid}/preview",
                "stream_url": None, "title": "Google Drive", "mime_type": None, "provider": "drive",
                "capabilities": {"seek": False, "rate_correction": False, "sync": False},
                "warning": "Drive bu dosyayı doğrudan akış olarak sunmuyor (izin, boyut veya virüs tarama sayfası). Resmî Drive oynatıcısı açılır; senkron kontrol yok.",
                "warning_code": "drive_embed"}

    ia = await _archive(url, parsed, referer)
    if ia:
        return ia

    await _assert_public(parsed.hostname)
    raw = _dropbox_raw(parsed)
    p = await _probe(raw or url, referer)
    _http_errors(p)
    c = _classify(raw or url, p, "dropbox" if raw else parsed.hostname)
    if c:
        name = unquote(parsed.path.rsplit("/", 1)[-1]).strip()[:120]
        if raw and c["kind"] == "direct":
            # The address Dropbox redirects to is short-lived; the share link itself keeps working for every request.
            c["stream_url"] = raw
        elif (parsed.hostname or "").lower() in IA_HOSTS and c["kind"] == "direct":
            c["stream_url"] = url  # archive.org/download/... is the permanent address; the data server behind it is not
        return {"url": url, "video_id": None, "embed_url": None, "title": name or parsed.hostname, "warning": None, **c}
    if HLS_EXT.search(url):
        raise ApiError(422, "manifest_invalid", "Adres .m3u8 ile bitiyor ama geçerli bir HLS manifesti döndürmüyor")
    if p["ctype"].startswith("text/html"):
        raise ApiError(422, "not_media", "Bu adres bir web sayfası, video dosyası değil")
    raise ApiError(422, "unsupported", f"Desteklenmeyen içerik türü: {p['ctype'] or 'bilinmiyor'}")
