"""Content policy: which pages may be used as video sources (Play/KVKK compliance)."""
from urllib.parse import urlparse

from config import (ALLOWED_SITES, APK_URL, QUIET_SITES, BLOCKED_HOSTS, CONTACT_EMAIL, MIN_AGE, OWNER_ADDRESS, OWNER_NAME, PLAY_URL, WEB_URL)
import config
import services
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
    return any(host_matches(host, s["domain"]) for s in ALLOWED_SITES) or any(host_matches(host, d) for d in QUIET_SITES)


def check_source(url, referer) -> None:
    """Raise ApiError when a source is not permitted.
    - URL or referer on a subscription/DRM platform -> 403 drm_not_allowed
    - referer given (detected in the in-app browser) but page is not an allowed site -> 403 site_not_supported
    Direct links without a referer (user's own MP4/HLS) stay allowed.
    A title/watch link of an in-app service (services.py) is allowed while SERVICES_ENABLED: nothing is fetched from it."""
    if config.SERVICES_ENABLED and services.match(url):
        return
    uhost = host_of(url)
    rhost = host_of(referer) if referer else ""
    if (uhost and is_blocked(uhost)) or (rhost and is_blocked(rhost)):
        raise ApiError(403, "drm_not_allowed", "Telif korumalı/abonelikli platformlardan içerik paylaşılamaz")
    if referer not in (None, ""):
        scheme = urlparse(referer.strip()).scheme if isinstance(referer, str) else ""
        if not rhost or scheme not in ("http", "https"):
            raise ApiError(400, "invalid_referer", "Geçersiz kaynak sayfa adresi (referer)")
        if not is_allowed_site(rhost):
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
        "min_age": MIN_AGE,
        "services_enabled": config.SERVICES_ENABLED,
    }
