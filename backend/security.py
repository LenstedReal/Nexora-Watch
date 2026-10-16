import hashlib
import hmac
import secrets
import time
from collections import defaultdict, deque

from fastapi.responses import JSONResponse

from config import MEDIA_SIGNING_SECRET


class ApiError(Exception):
    def __init__(self, status: int, code: str, detail: str):
        self.status, self.code, self.detail = status, code, detail


def api_error_response(exc: ApiError) -> JSONResponse:
    return JSONResponse({"detail": exc.detail, "code": exc.code}, status_code=exc.status)


def new_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def sign(payload: str, exp: int) -> str:
    return hmac.new(MEDIA_SIGNING_SECRET.encode(), f"{payload}:{exp}".encode(), hashlib.sha256).hexdigest()


def verify_sig(payload: str, exp: int, sig: str) -> bool:
    return exp > int(time.time()) and hmac.compare_digest(sign(payload, exp), sig or "")


class RateLimiter:
    def __init__(self, limit: int, window_s: float):
        self.limit, self.window = limit, window_s
        self.hits: dict[str, deque] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        q = self.hits[key]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.limit:
            return False
        q.append(now)
        return True
