"""Dashboard auth endpoints — login, logout, me."""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.built_in.auth import RequireUser
from src.app.built_in.auth.jwt import encode_token
from src.app.features.inbound_carrier_sales.db import get_session
from src.settings import get_settings

from . import service
from .models import UserORM
from .schemas import LoginRequest, LoginResponse, UserPublic

router = APIRouter(prefix="/auth", tags=["Auth"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]
logger = logging.getLogger("carrier_sales.auth")

_COOKIE_NAME = "session"


def _set_session_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    secure = settings.env_stage_name != "LOCAL"
    response.set_cookie(
        key=_COOKIE_NAME,
        value=token,
        max_age=settings.jwt_expires_minutes * 60,
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/",
    )


@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    response: Response,
    session: SessionDep,
) -> LoginResponse:
    user = await service.authenticate(session, request.email, request.password)
    if user is None:
        # Generic message — never leak which field was wrong.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    token = encode_token(user_id=user.id, email=user.email)
    _set_session_cookie(response, token)
    logger.info("login email=%s user_id=%s", user.email, user.id)
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=UserPublic.model_validate(user),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> Response:
    response.delete_cookie(_COOKIE_NAME, path="/")
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/me", response_model=UserPublic)
async def me(user: RequireUser) -> UserPublic:
    return UserPublic.model_validate(user)


# Type alias is referenced by FastAPI for dependency resolution.
__all__ = ["router", "UserORM"]
