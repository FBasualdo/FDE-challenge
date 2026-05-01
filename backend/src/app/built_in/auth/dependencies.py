"""API key authentication dependency."""

import secrets
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status

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
