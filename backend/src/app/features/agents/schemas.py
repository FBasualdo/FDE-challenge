"""Pydantic schemas for the agents feature."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class Agent(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    name: str
    description: str | None = None
    is_active: bool


class AgentListResponse(BaseModel):
    agents: list[Agent]
