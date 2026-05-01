"""Request/response models for the inbound carrier sales feature."""

from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum
from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# 1. POST /carriers/verify
# ---------------------------------------------------------------------------


class VerifyCarrierRequest(BaseModel):
    mc_number: str


class VerifyCarrierResponse(BaseModel):
    eligible: bool
    mc_number: str
    carrier_name: str | None = None
    dot_number: str | None = None
    status: str | None = None
    allowed_to_operate: bool | None = None
    reason: str | None = None


# ---------------------------------------------------------------------------
# 2. GET /loads/search
# ---------------------------------------------------------------------------


class Load(BaseModel):
    # Built from a SQLAlchemy `LoadORM` instance via the service mapper.
    # `from_attributes=True` lets us also do `Load.model_validate(row)` if needed later.
    model_config = ConfigDict(from_attributes=True)

    load_id: str
    origin: str
    destination: str
    pickup_datetime: datetime
    delivery_datetime: datetime
    equipment_type: str
    loadboard_rate: float
    notes: str
    weight: int
    commodity_type: str
    num_of_pieces: int
    miles: int
    dimensions: str
    pitch_summary: str


class SearchLoadsResponse(BaseModel):
    matches_found: int
    more_available: bool
    loads: list[Load]


# ---------------------------------------------------------------------------
# 3. POST /negotiations/evaluate
# ---------------------------------------------------------------------------


class EvaluateNegotiationRequest(BaseModel):
    call_id: str
    load_id: str
    carrier_offer: float = Field(gt=0)
    round_number: int = Field(ge=1, le=3)


NegotiationAction = Literal["accept", "counter", "reject"]


class EvaluateNegotiationResponse(BaseModel):
    action: NegotiationAction
    agreed_rate: float | None = None
    counter_price: float | None = None
    final_offer: float | None = None
    round_number: int
    rounds_remaining: int
    message_for_agent: str


# ---------------------------------------------------------------------------
# 4. POST /calls
# ---------------------------------------------------------------------------


class CallOutcome(StrEnum):
    BOOKED = "Booked"
    NEGOTIATION_FAILED = "Negotiation Failed"
    NOT_ELIGIBLE = "Not Eligible"
    NO_MATCH_FOUND = "No Match Found"
    CARRIER_DECLINED = "Carrier Declined"
    CALL_DROPPED = "Call Dropped"


class CallSentiment(StrEnum):
    POSITIVE = "Positive"
    NEUTRAL = "Neutral"
    NEGATIVE = "Negative"


class CallCarrier(BaseModel):
    mc_number: str | None = None
    carrier_name: str | None = None
    eligible: bool | None = None


class CallLoad(BaseModel):
    load_id: str | None = None
    loadboard_rate: float | None = None


class CallNegotiation(BaseModel):
    rounds: int
    final_agreed_rate: float | None = None


class IngestCallRequest(BaseModel):
    call_id: str
    # AwareDatetime rejects naive datetimes at the validation boundary so we
    # never persist a tz-naive value into a TIMESTAMP WITH TIME ZONE column.
    started_at: AwareDatetime
    ended_at: AwareDatetime
    duration_seconds: int = Field(ge=0)
    carrier: CallCarrier | None = None
    load: CallLoad | None = None
    negotiation: CallNegotiation | None = None
    outcome: CallOutcome
    sentiment: CallSentiment
    transcript: str | None = None
    recording_url: str | None = None


class IngestCallResponse(BaseModel):
    saved: bool
    call_id: str
    created: bool


# ---------------------------------------------------------------------------
# 5. GET /metrics/summary
# ---------------------------------------------------------------------------


class MetricsTotals(BaseModel):
    total_calls: int
    booked_calls: int
    booking_rate: float
    total_revenue_negotiated: float


class MetricsNegotiation(BaseModel):
    avg_rounds_to_close: float | None
    avg_margin_vs_loadboard: float | None
    deals_closed_at_or_below_loadboard: int
    deals_closed_above_loadboard: int


class MetricsQuality(BaseModel):
    sentiment_distribution: dict[str, int]
    avg_call_duration_seconds: float | None
    carrier_eligibility_rate: float | None


class CallsByDayEntry(BaseModel):
    date: date
    count: int
    booked: int


class MetricsSummaryResponse(BaseModel):
    totals: MetricsTotals
    negotiation: MetricsNegotiation
    quality: MetricsQuality
    outcomes_distribution: dict[str, int]
    calls_by_day: list[CallsByDayEntry]
