import logging
import os
import secrets
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")
log = logging.getLogger("nexora.config")

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "nexora")
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]

MEDIA_SIGNING_SECRET = os.environ.get("MEDIA_SIGNING_SECRET", "")
if not MEDIA_SIGNING_SECRET:
    # Dev fallback only: signed media URLs become invalid after every restart.
    MEDIA_SIGNING_SECRET = secrets.token_hex(32)
    log.warning("MEDIA_SIGNING_SECRET is not set; using a random per-process secret (set it in production)")

ROOM_LIFETIME_S = int(os.environ.get("ROOM_LIFETIME_HOURS", "24")) * 3600
ROOM_PURGE_GRACE_S = int(os.environ.get("ROOM_PURGE_GRACE_HOURS", "24")) * 3600

MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", str(2 * 1024**3)))
STORAGE_QUOTA_BYTES = int(os.environ.get("STORAGE_QUOTA_BYTES", str(18 * 1024**3)))
PARTICIPANT_QUOTA_BYTES = int(os.environ.get("PARTICIPANT_QUOTA_BYTES", str(4 * 1024**3)))
STORAGE_WARN_RATIO = float(os.environ.get("STORAGE_WARN_RATIO", "0.8"))
OCI_MONTHLY_REQUEST_LIMIT = int(os.environ.get("OCI_MONTHLY_REQUEST_LIMIT", "45000"))
MEDIA_RETENTION_DAYS = int(os.environ.get("MEDIA_RETENTION_DAYS", "7"))
STALE_UPLOAD_HOURS = int(os.environ.get("STALE_UPLOAD_HOURS", "24"))

# Local disk storage (default). In Docker this is a mounted volume.
MEDIA_DIR = Path(os.environ.get("MEDIA_DIR", str(Path(__file__).parent / "data" / "media"))).resolve()

OCI_S3_ENDPOINT = os.environ.get("OCI_S3_ENDPOINT", "")
OCI_REGION = os.environ.get("OCI_REGION", "")
OCI_ACCESS_KEY = os.environ.get("OCI_ACCESS_KEY", "")
OCI_SECRET_KEY = os.environ.get("OCI_SECRET_KEY", "")
OCI_BUCKET = os.environ.get("OCI_BUCKET", "")

STORAGE_DRIVER = "oci" if all([OCI_S3_ENDPOINT, OCI_REGION, OCI_ACCESS_KEY, OCI_SECRET_KEY, OCI_BUCKET]) else "local"

MEDIA_DELETE_AFTER_CLOSE_HOURS = float(os.environ.get("MEDIA_DELETE_AFTER_CLOSE_HOURS", "1"))

# --- Public app config / content policy -------------------------------------------------------------------
WEB_URL = os.environ.get("WEB_URL", "https://nexora.lenstedreal.info").rstrip("/")
PLAY_URL = os.environ.get("PLAY_URL", "")
APK_URL = os.environ.get("APK_URL", "https://github.com/LenstedReal/Nexora-Watch/releases/latest")
CONTACT_EMAIL = os.environ.get("CONTACT_EMAIL", "destek@lenstedreal.info")
# KVKK data controller shown on the legal pages (set OWNER_NAME to your full legal name in .env).
OWNER_NAME = os.environ.get("OWNER_NAME", "").strip()
OWNER_ADDRESS = os.environ.get("OWNER_ADDRESS", "").strip()

_DEFAULT_SITES = ("youtube.com|YouTube,vimeo.com|Vimeo,dailymotion.com|Dailymotion,archive.org|Internet Archive,"
                  "twitch.tv|Twitch,drive.google.com|Google Drive")
ALLOWED_SITES: list[dict] = []
for _item in (os.environ.get("ALLOWED_SITES") or _DEFAULT_SITES).split(","):
    _dom, _, _name = _item.strip().partition("|")
    _dom = _dom.strip().lower().lstrip(".")
    if _dom:
        ALLOWED_SITES.append({"domain": _dom, "name": (_name.strip() or _dom)})

_DEFAULT_BLOCKED = ("netflix.com,disneyplus.com,primevideo.com,amazon.com,max.com,hbomax.com,blutv.com,exxen.com,"
                    "gain.com.tr,tabii.com,puhutv.com,mubi.com,tv.apple.com,spotify.com")
BLOCKED_HOSTS = [h.strip().lower().lstrip(".") for h in (os.environ.get("BLOCKED_HOSTS") or _DEFAULT_BLOCKED).split(",") if h.strip()]
