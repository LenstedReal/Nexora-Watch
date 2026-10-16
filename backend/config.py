import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*").split(",")
MEDIA_SIGNING_SECRET = os.environ["MEDIA_SIGNING_SECRET"]

ROOM_LIFETIME_S = int(os.environ.get("ROOM_LIFETIME_HOURS", "24")) * 3600
ROOM_PURGE_GRACE_S = int(os.environ.get("ROOM_PURGE_GRACE_HOURS", "24")) * 3600

MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", str(2 * 1024**3)))
STORAGE_QUOTA_BYTES = int(os.environ.get("STORAGE_QUOTA_BYTES", str(18 * 1024**3)))
PARTICIPANT_QUOTA_BYTES = int(os.environ.get("PARTICIPANT_QUOTA_BYTES", str(4 * 1024**3)))
STORAGE_WARN_RATIO = float(os.environ.get("STORAGE_WARN_RATIO", "0.8"))
OCI_MONTHLY_REQUEST_LIMIT = int(os.environ.get("OCI_MONTHLY_REQUEST_LIMIT", "45000"))
MEDIA_RETENTION_DAYS = int(os.environ.get("MEDIA_RETENTION_DAYS", "7"))
STALE_UPLOAD_HOURS = int(os.environ.get("STALE_UPLOAD_HOURS", "24"))

OCI_S3_ENDPOINT = os.environ.get("OCI_S3_ENDPOINT", "")
OCI_REGION = os.environ.get("OCI_REGION", "")
OCI_ACCESS_KEY = os.environ.get("OCI_ACCESS_KEY", "")
OCI_SECRET_KEY = os.environ.get("OCI_SECRET_KEY", "")
OCI_BUCKET = os.environ.get("OCI_BUCKET", "")

STORAGE_DRIVER = "oci" if all([OCI_S3_ENDPOINT, OCI_REGION, OCI_ACCESS_KEY, OCI_SECRET_KEY, OCI_BUCKET]) else "local"
