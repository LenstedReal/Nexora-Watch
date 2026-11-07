"""Content policy: which pages may be used as video sources (Play/KVKK compliance)."""
from urllib.parse import urlparse

from config import (ALLOWED_SITES, APK_URL, BLOCKED_HOSTS, CONTACT_EMAIL, OWNER_ADDRESS, OWNER_NAME, PLAY_URL, WEB_URL)
from security import ApiError


def host_of(url) -> str:
    try:
        return (urlparse(url.strip()).hostname or "").lower() if isinstance(url, str) else ""
    except ValueError:
        return ""


def host_matches(host: str, domain: str) -> bool:
    return bool(host) and (host == domain or host.endswith("." + domain))


def is_blocked(host: str) -> bool:
    return any(host_matches(host, d) for d in BLOCKED_HOSTS)


def is_allowed_site(host: str) -> bool:
    return any(host_matches(host, s["domain"]) for s in ALLOWED_SITES)


def check_source(url, referer) -> None:
    """Raise ApiError when a source is not permitted.
    - URL or referer on a subscription/DRM platform -> 403 drm_not_allowed
    - referer given (detected in the in-app browser) but page is not an allowed site -> 403 site_not_supported
    Direct links without a referer (user's own MP4/HLS) stay allowed."""
    uhost = host_of(url)
    rhost = host_of(referer) if referer else ""
    if (uhost and is_blocked(uhost)) or (rhost and is_blocked(rhost)):
        raise ApiError(403, "drm_not_allowed", "Telif korumalı/abonelikli platformlardan içerik paylaşılamaz")
    if referer not in (None, "") and not is_allowed_site(rhost):
        raise ApiError(403, "site_not_supported", "Bu site desteklenmiyor")


def public_config() -> dict:
    return {
        "allowed_sites": ALLOWED_SITES,
        "web_url": WEB_URL,
        "play_url": PLAY_URL,
        "apk_url": APK_URL,
        "contact_email": CONTACT_EMAIL,
        "owner": {"name": OWNER_NAME, "address": OWNER_ADDRESS},
        "legal": {
            "privacy": f"{WEB_URL}/gizlilik",
            "terms": f"{WEB_URL}/kosullar",
            "kvkk": f"{WEB_URL}/kvkk",
            "copyright": f"{WEB_URL}/telif",
            "delete_data": f"{WEB_URL}/veri-silme",
            "child_safety": f"{WEB_URL}/cocuk-guvenligi",
        },
        "min_age": 13,
    }
