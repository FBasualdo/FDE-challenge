"""Pydantic schemas for dashboard call browsing."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class CallSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    call_id: str
    agent_id: str
    started_at: datetime
    duration_seconds: int
    outcome: str
    sentiment: str
    carrier_name: str | None = None
    mc_number: str | None = None
    load_id: str | None = None
    final_agreed_rate: float | None = None
    transcript_preview: str | None = None


class CallListResponse(BaseModel):
    items: list[CallSummary]
    next_cursor: str | None = None
    total: int


class ToolInvocation(BaseModel):
    name: str
    args: dict[str, Any] = Field(default_factory=dict)
    result: dict[str, Any] | list[Any] | str | None = None
    ts: float | None = None


class NegotiationRoundSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    round: int
    carrier_offer: float
    action: str
    broker_price: float | None = None
    decided_at: datetime


class VerificationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    mc_number: str
    eligible: bool
    carrier_name: str | None = None
    dot_number: str | None = None
    status: str | None = None
    reason: str | None = None
    checked_at: datetime


class CallDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    call_id: str
    agent_id: str
    started_at: datetime
    ended_at: datetime
    duration_seconds: int
    outcome: str
    sentiment: str
    carrier: dict[str, Any] | None = None
    load: dict[str, Any] | None = None
    negotiation: dict[str, Any] | None = None
    analysis: dict[str, Any] | None = None
    transcript: str | None = None
    recording_url: str | None = None
    created_at: datetime
    updated_at: datetime
    negotiation_rounds: list[NegotiationRoundSummary] = Field(default_factory=list)
    verifications: list[VerificationSummary] = Field(default_factory=list)
    tool_invocations: list[ToolInvocation] = Field(default_factory=list)
