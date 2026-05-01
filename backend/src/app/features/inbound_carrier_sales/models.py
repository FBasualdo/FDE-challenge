"""SQLAlchemy 2.0 ORM models for the inbound carrier sales feature.

Suffixed with `ORM` to keep them visually distinct from the Pydantic schemas
in `schemas.py`. The service layer maps between the two explicitly.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class LoadORM(Base):
    __tablename__ = "loads"

    load_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    origin: Mapped[str] = mapped_column(String(128), index=True)
    destination: Mapped[str] = mapped_column(String(128), index=True)
    pickup_datetime: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    delivery_datetime: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    equipment_type: Mapped[str] = mapped_column(String(128), index=True)
    loadboard_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    notes: Mapped[str] = mapped_column(Text, default="")
    weight: Mapped[int] = mapped_column(Integer)
    commodity_type: Mapped[str] = mapped_column(Text)
    num_of_pieces: Mapped[int] = mapped_column(Integer)
    miles: Mapped[int] = mapped_column(Integer)
    dimensions: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class VerificationORM(Base):
    __tablename__ = "verifications"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    mc_number: Mapped[str] = mapped_column(String(16), index=True)
    eligible: Mapped[bool] = mapped_column(Boolean, nullable=False)
    carrier_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    dot_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_response: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    checked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )


class NegotiationRoundORM(Base):
    """One row per negotiation evaluation.

    `call_id` intentionally has NO foreign key to `calls`. The negotiation rows
    are written during a live call (POST /negotiations/evaluate), but the
    matching `calls` row is only persisted later when the agent calls
    POST /calls at end-of-call. A FK would force ordering we don't actually have.
    """

    __tablename__ = "negotiation_rounds"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    call_id: Mapped[str] = mapped_column(String(64), index=True)
    load_id: Mapped[str] = mapped_column(String(32), index=True)
    round: Mapped[int] = mapped_column(SmallInteger)
    carrier_offer: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    action: Mapped[str] = mapped_column(String(16))  # 'accept' | 'counter' | 'reject'
    broker_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    decided_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        Index("ix_negotiation_rounds_call_round", "call_id", "round"),
    )


class CallORM(Base):
    __tablename__ = "calls"

    call_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    duration_seconds: Mapped[int] = mapped_column(Integer)

    # Denormalized JSONB snapshots — keeps reads single-trip and forward-compatible
    # with whatever fields the voice agent decides to add next sprint.
    carrier: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    load: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    negotiation: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    outcome: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    sentiment: Mapped[str] = mapped_column(String(16), nullable=False)
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    recording_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
