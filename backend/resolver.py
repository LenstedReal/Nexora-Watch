import asyncio
import ipaddress
import re
import socket
from urllib.parse import urlparse

import httpx

from security import ApiError

YT_RE = re.compile(r"(?:youtube\.com/(?:watch\?(?:.*&)?v=|embed/|shorts/|live/)|youtu\.be/|youtube-nocookie\.com/embed/)([\w-]{11})")
DRIVE_RE = re.compile(r"drive\.google\.com/(?:file/d/|open\?id=|uc\?(?:.*&)?id=)([\w-]{20,})")
DIRECT_EXT = re.compile(r"\.(mp4|webm|mov|m4v)(?:$|[?#])", re.I)
HLS_EXT = re.compile(r"\.m3u8(?:$|[?#])", re.I)

FULL_CAPS = {"seek": True, "rate_correction": True, "sync": True}


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


async def _probe(url: str) -> dict:
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=8, max_redirects=5, event_hooks={"request": [_guard]}) as c:
            async with c.stream("GET", url, headers={"Range": "bytes=0-2047", "User-Agent": "NexoraWatch/1.0"}) as r:
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
                "warning": None if ranged else "Sunucu HTTP Range desteklemiyor; ileri/geri sarma güvenilir olmayabilir"}
    return None


async def resolve(url_in) -> dict:
    url = url_in.strip() if isinstance(url_in, str) else ""
    if not url or len(url) > 4000:
        raise ApiError(400, "invalid_url", "Geçerli bir video adresi gerekli")
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ApiError(400, "invalid_url", "Adres http(s) ile başlamalı")

    yt = YT_RE.search(url)
    if yt:
        vid = yt.group(1)
        return {"url": url, "kind": "youtube", "video_id": vid, "embed_url": f"https://www.youtube.com/embed/{vid}",
                "stream_url": None, "title": "YouTube", "mime_type": None, "provider": "youtube",
                "capabilities": {"seek": True, "rate_correction": False, "sync": True}, "warning": None}

    drive = DRIVE_RE.search(url)
    if drive:
        fid = drive.group(1)
        direct = f"https://drive.google.com/uc?export=download&id={fid}"
        try:
            p = await _probe(direct)
            if p["status"] < 400:
                c = _classify(direct, p, "drive")
                if c:
                    return {"url": url, "video_id": fid, "embed_url": None, "title": "Google Drive", **c}
        except ApiError:
            pass
        return {"url": url, "kind": "drive_embed", "video_id": fid, "embed_url": f"https://drive.google.com/file/d/{fid}/preview",
                "stream_url": None, "title": "Google Drive", "mime_type": None, "provider": "drive",
                "capabilities": {"seek": False, "rate_correction": False, "sync": False},
                "warning": "Drive bu dosyayı doğrudan akış olarak sunmuyor (izin, boyut veya virüs tarama sayfası). Resmî Drive oynatıcısı açılır; senkron kontrol yok."}

    await _assert_public(parsed.hostname)
    p = await _probe(url)
    _http_errors(p)
    c = _classify(url, p, parsed.hostname)
    if c:
        return {"url": url, "video_id": None, "embed_url": None, "title": parsed.path.rsplit("/", 1)[-1] or parsed.hostname, "warning": None, **c}
    if HLS_EXT.search(url):
        raise ApiError(422, "manifest_invalid", "Adres .m3u8 ile bitiyor ama geçerli bir HLS manifesti döndürmüyor")
    if p["ctype"].startswith("text/html"):
        raise ApiError(422, "not_media", "Bu adres bir web sayfası, video dosyası değil")
    raise ApiError(422, "unsupported", f"Desteklenmeyen içerik türü: {p['ctype'] or 'bilinmiyor'}")
