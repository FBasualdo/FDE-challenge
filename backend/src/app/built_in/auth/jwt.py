"""JWT helpers for dashboard auth.

Kept separate from the API-key dependency so the voice-agent surface
(`X-API-Key`) remains untouched. Dashboard endpoints use JWT (cookie OR
bearer header) via the `RequireUser` dependency.

POC-scoped: there is no per-user identity. The token's `sub` is the
literal string `"dashboard"`. Login compares the supplied password
against `settings.dashboard_password` via `secrets.compare_digest` —
no passwords are ever stored.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import jwt

from src.settings import get_settings

_JWT_ALGORITHM = "HS256"
_JWT_SUBJECT = "dashboard"


def encode_token(subject: str = _JWT_SUBJECT) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.jwt_expires_minutes)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=_JWT_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret, algorithms=[_JWT_ALGORITHM])
