"""Pydantic schemas for the dashboard load catalog browser."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class LoadCatalogItem(BaseModel):
    """One row in the dashboard catalog view.

    Mirrors every column on `LoadORM` and adds a derived `pitch_summary`
    so the dashboard can render the same one-liner the voice agent reads
    on a call.

    The `is_booked` / `booked_*` fields surface the latest booking call
    metadata (computed at query time via a DISTINCT ON subquery against
    `calls` — no schema change). When a load has never been booked,
    `is_booked` is False and the rest stay null.
    """

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
    created_at: datetime
    pitch_summary: str

    is_booked: bool = False
    booked_at: datetime | None = None
    booked_by_mc: str | None = None
    booked_by_call_id: str | None = None
    booked_agreed_rate: float | None = None


class LoadCatalogResponse(BaseModel):
    items: list[LoadCatalogItem]
    next_cursor: str | None = None
    total: int
