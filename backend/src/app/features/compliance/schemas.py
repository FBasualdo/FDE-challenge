"""Pydantic schemas for the FMCSA compliance audit log."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class VerificationDetail(BaseModel):
    """One row in the dashboard FMCSA audit log.

    Mirrors every column on `VerificationORM`, including the JSONB
    `raw_response` so the dashboard can show what FMCSA actually said
    (carrier name from the API vs. local override, status codes, etc.).
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    mc_number: str
    eligible: bool
    carrier_name: str | None = None
    dot_number: str | None = None
    status: str | None = None
    reason: str | None = None
    raw_response: dict[str, Any] | None = None
    checked_at: datetime


class VerificationListResponse(BaseModel):
    items: list[VerificationDetail]
    next_cursor: str | None = None
    total: int
