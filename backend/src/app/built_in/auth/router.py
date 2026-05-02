"""Dashboard auth endpoints — login, logout, me.

POC-scoped: a single shared `DASHBOARD_PASSWORD` env var gates access.
No users table, no email, no per-user identity. `secrets.compare_digest`
keeps the comparison constant-time.
"""

from __future__ import annotations

import logging
import secrets

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel, Field

from src.app.built_in.auth import RequireUser
from src.app.built_in.auth.jwt import encode_token
from src.settings import get_settings

router = APIRouter(prefix="/auth", tags=["Auth"])
logger = logging.getLogger("carrier_sales.auth")

_COOKIE_NAME = "session"


class LoginRequest(BaseModel):
    password: str = Field(min_length=1, max_length=512)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AuthStatus(BaseModel):
    authenticated: bool


def _set_session_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    is_prod = settings.env_stage_name != "LOCAL"
    # Cross-site cookie support: when the dashboard sits on a different
    # subdomain than the API (e.g. Railway gives us
    # fde-...-dashboard.up.railway.app -> fde-....up.railway.app), the
    # browser only sends the session cookie back if SameSite=None and
    # Secure=True. Locally we keep SameSite=Lax so HTTP dev still works.
    response.set_cookie(
        key=_COOKIE_NAME,
        value=token,
        max_age=settings.jwt_expires_minutes * 60,
        httponly=True,
        secure=is_prod,
        samesite="none" if is_prod else "lax",
        path="/",
    )


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, response: Response) -> LoginResponse:
    settings = get_settings()
    expected = settings.dashboard_password

    # Deny outright when the server has no passcode configured. In LOCAL
    # this means the operator hasn't set DASHBOARD_PASSWORD yet; in any
    # other stage the boot guard would have already refused to start.
    if not expected or not secrets.compare_digest(request.password, expected):
        # Generic message — never leak whether the env var is empty vs mismatched.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    token = encode_token()
    _set_session_cookie(response, token)
    logger.info("login ok")
    return LoginResponse(access_token=token, token_type="bearer")


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> Response:
    # No auth required — logout-while-already-out is a no-op success.
    response.delete_cookie(_COOKIE_NAME, path="/")
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/me", response_model=AuthStatus)
async def me(_: RequireUser) -> AuthStatus:
    return AuthStatus(authenticated=True)
