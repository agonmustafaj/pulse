from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from .common import ApiMeta


class Event(BaseModel):
    id: str
    title: str
    description: str | None = None
    category: str
    latitude: float | None = None
    longitude: float | None = None
    location_name: str | None = None
    timestamp: datetime | None = None
    source: str
    source_url: str | None = None
    severity: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class EventsResponse(ApiMeta):
    items: list[Event] = Field(default_factory=list)
    total: int = 0
