"""Auth dependencies — API key (voice agent) and JWT user (dashboard).

Both coexist. The voice-agent endpoints continue to use `RequireApiKey`
(X-API-Key header). Dashboard endpoints use `RequireUser` which accepts
EITHER a `Authorization: Bearer ...` header OR a `session=...` cookie.
"""

from __future__ import annotations

import secrets
from typing import Annotated

import jwt as pyjwt
from fastapi import Cookie, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.built_in.auth.jwt import decode_token
from src.app.features.inbound_carrier_sales.db import get_session
from src.app.features.users.models import UserORM
from src.settings import get_settings


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
    session: Annotated[AsyncSession, Depends(get_session)],
    authorization: Annotated[str | None, Header()] = None,
    session_cookie: Annotated[str | None, Cookie(alias="session")] = None,
) -> UserORM:
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

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session token",
        )

    user = (
        await session.execute(select(UserORM).where(UserORM.id == user_id))
    ).scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    return user


RequireUser = Annotated[UserORM, Depends(require_user)]
