"""Pydantic schemas for the dashboard load catalog browser."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class LoadCatalogItem(BaseModel):
    """One row in the dashboard catalog view.

    Mirrors every column on `LoadORM` and adds a derived `pitch_summary`
    so the dashboard can render the same one-liner the voice agent reads
    on a call.
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


class LoadCatalogResponse(BaseModel):
    items: list[LoadCatalogItem]
    next_cursor: str | None = None
    total: int
