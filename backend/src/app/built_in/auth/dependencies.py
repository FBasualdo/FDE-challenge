"""Auth dependencies — API key (voice agent) and JWT session (dashboard).

Both coexist. The voice-agent endpoints continue to use `RequireApiKey`
(X-API-Key header). Dashboard endpoints use `RequireUser` which accepts
EITHER an `Authorization: Bearer ...` header OR a `session=...` cookie.

POC-scoped: there is no per-user identity. A valid JWT means "the
caller knows the shared dashboard passcode". The dependency returns a
sentinel `Authenticated` instance (not a user row) so endpoints can
keep typing the dependency without leaking user-model assumptions.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from typing import Annotated

import jwt as pyjwt
from fastapi import Cookie, Depends, Header, HTTPException, status

from src.app.built_in.auth.jwt import decode_token
from src.settings import get_settings


@dataclass(frozen=True)
class Authenticated:
    """Sentinel returned by `require_user` when a request carries a valid JWT.

    Carries no user identity — the POC uses a single shared dashboard
    passcode, so there is nothing to identify. Exists as a typed return
    value so `RequireUser` keeps its readable name in endpoint signatures.
    """

    subject: str = "dashboard"


async def require_api_key(
    x_api_key: Annotated[str | None, Header()] = None,
) -> None:
    """Validate the X-API-Key header against the configured API_KEY.

    LOCAL stage bypasses auth so the dashboard works without secrets in dev.
    Any other stage rejects requests without a matching key.
    """
    settings = get_settings()

    if settings.env_stage_name == "LOCAL" and not settings.api_key:
        return

    if not settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="API_KEY is not configured on the server",
        )

    if not x_api_key or not secrets.compare_digest(x_api_key, settings.api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-API-Key",
        )


RequireApiKey = Depends(require_api_key)


def _extract_token(authorization: str | None, session_cookie: str | None) -> str | None:
    if authorization:
        scheme, _, value = authorization.partition(" ")
        if scheme.lower() == "bearer" and value:
            return value.strip()
    if session_cookie:
        return session_cookie.strip() or None
    return None


async def require_user(
    authorization: Annotated[str | None, Header()] = None,
    session_cookie: Annotated[str | None, Cookie(alias="session")] = None,
) -> Authenticated:
    token = _extract_token(authorization, session_cookie)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    try:
        payload = decode_token(token)
    except pyjwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired",
        ) from exc
    except pyjwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session token",
        ) from exc

    subject = payload.get("sub")
    if subject != "dashboard":
        # Reject tokens that don't match the only subject we ever mint.
        # Defensive: a leaked JWT_SECRET re-used from another product would
        # otherwise let arbitrary tokens through.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session token",
        )

    return Authenticated(subject=subject)


RequireUser = Annotated[Authenticated, Depends(require_user)]
