"""Request/response models for the inbound carrier sales feature."""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta, timezone
from enum import StrEnum
from typing import Any, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator, model_validator

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
    model_config = ConfigDict(extra="allow")
    mc_number: str | None = None
    carrier_name: str | None = None
    eligible: bool | None = None


class CallLoad(BaseModel):
    model_config = ConfigDict(extra="allow")
    load_id: str | None = None
    loadboard_rate: float | None = None


class CallNegotiation(BaseModel):
    model_config = ConfigDict(extra="allow")
    rounds: int = 0
    final_agreed_rate: float | None = None


class IngestCallRequest(BaseModel):
    call_id: str = Field(min_length=1, max_length=128)
    started_at: AwareDatetime | None = None
    ended_at: AwareDatetime | None = None
    duration_seconds: int = Field(default=0, ge=0, le=24 * 3600)
    carrier: CallCarrier | None = None
    load: CallLoad | None = None
    negotiation: CallNegotiation | None = None
    # outcome and sentiment can also be supplied inside `analysis` (Extract
    # node output). The model_validator below promotes them to the root if
    # missing here. Marked Optional so Pydantic doesn't 422 before we get a
    # chance to look in `analysis`.
    outcome: CallOutcome | None = None
    sentiment: CallSentiment | None = None
    analysis: dict[str, Any] | None = None
    transcript: str | None = Field(default=None, max_length=200_000)
    recording_url: str | None = Field(default=None, max_length=2_048)

    @field_validator("load", mode="before")
    @classmethod
    def _coerce_load(cls, v: Any) -> Any:
        # Voice platforms sometimes JSON-encode array fields as strings, or
        # pass the entire `loads[...]` array instead of a single load. Be
        # tolerant: parse strings, unwrap arrays, accept dicts as-is.
        if v is None or isinstance(v, dict):
            return v
        if isinstance(v, str):
            try:
                v = json.loads(v)
            except (ValueError, TypeError):
                return None
        if isinstance(v, list):
            return v[0] if v else None
        return v

    @field_validator("analysis", mode="before")
    @classmethod
    def _coerce_analysis(cls, v: Any) -> Any:
        if v is None or isinstance(v, dict):
            return v
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, dict) else None
            except (ValueError, TypeError):
                return None
        return None

    @model_validator(mode="after")
    def _fill_timestamps_and_promote_from_analysis(self) -> "IngestCallRequest":
        # Defaults for callers (e.g. HappyRobot tools) that don't have call
        # start/end as platform variables. We synthesize a window from the
        # duration so calls_by_day still bucketizes them correctly.
        if self.started_at is None and self.ended_at is None:
            now = datetime.now(timezone.utc)
            self.ended_at = now
            self.started_at = now - timedelta(seconds=self.duration_seconds or 0)
        elif self.started_at is None:
            self.started_at = self.ended_at - timedelta(seconds=self.duration_seconds or 0)
        elif self.ended_at is None:
            self.ended_at = self.started_at + timedelta(seconds=self.duration_seconds or 0)

        # Promote outcome / sentiment from analysis when missing at root.
        # Lets the bot ship the Extract node's output as a single nested
        # block instead of duplicating fields at the top level.
        if self.analysis:
            if self.outcome is None and (a_outcome := self.analysis.get("outcome")):
                try:
                    self.outcome = CallOutcome(a_outcome)
                except ValueError as e:
                    raise ValueError(
                        f"analysis.outcome={a_outcome!r} is not a valid outcome tag"
                    ) from e
            if self.sentiment is None and (a_sentiment := self.analysis.get("sentiment")):
                try:
                    self.sentiment = CallSentiment(a_sentiment)
                except ValueError as e:
                    raise ValueError(
                        f"analysis.sentiment={a_sentiment!r} is not a valid sentiment tag"
                    ) from e

        if self.outcome is None:
            raise ValueError("outcome is required (either at top level or inside analysis.outcome)")
        if self.sentiment is None:
            raise ValueError(
                "sentiment is required (either at top level or inside analysis.sentiment)"
            )
        return self


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


class RepeatFunnel(BaseModel):
    once: int
    two_to_three: int
    four_plus: int


class TopCarrier(BaseModel):
    mc_number: str
    carrier_name: str | None = None
    calls: int
    bookings: int
    booking_rate: float | None = None
    total_revenue: float


class MetricsSummaryResponse(BaseModel):
    totals: MetricsTotals
    negotiation: MetricsNegotiation
    quality: MetricsQuality
    outcomes_distribution: dict[str, int]
    calls_by_day: list[CallsByDayEntry]
    round_one_close_rate: float | None = None
    fmcsa_killed_rate: float | None = None
    repeat_funnel: RepeatFunnel | None = None
    top_carriers: list[TopCarrier] = []
