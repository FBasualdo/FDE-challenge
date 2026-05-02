"""Pydantic schemas for the analytics endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from src.app.features.dashboard_calls.schemas import (
    CallSummary,
    VerificationSummary,
)

# ---------------------------------------------------------------------------
# /metrics/carriers (list)
# ---------------------------------------------------------------------------


class CarrierStats(BaseModel):
    mc_number: str
    carrier_name: str | None = None
    calls: int  # total calls including Not Eligible
    conversational_calls: int  # excludes Not Eligible — basis for "relationship"
    booked: int
    booking_rate: float  # booked / conversational_calls (0 if denom == 0)
    avg_sentiment_score: float  # P=+1, N=0, X=-1, then averaged
    sentiment_trend: list[str] = Field(default_factory=list)  # last 5 sentiments oldest→newest
    avg_quote_premium_pct: float | None = None
    premium_share_pct: float | None = None
    drop_rate: float
    last_called_at: datetime
    flags: list[str] = Field(default_factory=list)


class CarrierListResponse(BaseModel):
    items: list[CarrierStats]
    next_cursor: str | None = None
    total: int


# ---------------------------------------------------------------------------
# /metrics/carriers/{mc_number} (detail)
# ---------------------------------------------------------------------------


class SentimentPoint(BaseModel):
    at: datetime
    sentiment: str  # "Positive" | "Neutral" | "Negative"


class CarrierDetail(BaseModel):
    mc_number: str
    carrier_name: str | None = None
    total_calls: int
    conversational_calls: int
    booked: int
    booking_rate: float
    flags: list[str] = Field(default_factory=list)
    recent_calls: list[CallSummary] = Field(default_factory=list)
    sentiment_timeline: list[SentimentPoint] = Field(default_factory=list)
    verifications: list[VerificationSummary] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# /metrics/lanes
# ---------------------------------------------------------------------------


LaneTrend = Literal["heating", "cooling", "flat"]


class LaneStats(BaseModel):
    origin: str
    destination: str
    calls: int
    booked: int
    booking_rate: float
    avg_loadboard_rate: float | None = None
    avg_agreed_rate: float | None = None
    avg_margin_vs_lb_pct: float | None = None
    equipment_mix: dict[str, int] = Field(default_factory=dict)
    calls_prev_window: int
    trend: LaneTrend


class LaneListResponse(BaseModel):
    items: list[LaneStats]


# ---------------------------------------------------------------------------
# /metrics/negotiation
# ---------------------------------------------------------------------------


class RoundAcceptance(BaseModel):
    round: int
    accepts: int
    counters: int
    rejects: int


class GapBucket(BaseModel):
    bucket: str
    count: int


class MoneyLeftStats(BaseModel):
    total: float
    avg_per_booked_call: float | None = None
    p50: float | None = None
    p90: float | None = None
    savings_count: int


class NegotiationStats(BaseModel):
    acceptance_by_round: list[RoundAcceptance] = Field(default_factory=list)
    round_one_close_rate: float | None = None
    final_offer_success_rate: float | None = None
    gap_histogram_round1: list[GapBucket] = Field(default_factory=list)
    money_left_on_table: MoneyLeftStats
