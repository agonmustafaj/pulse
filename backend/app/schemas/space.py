from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from .common import ApiMeta


class ISSPosition(BaseModel):
    latitude: float
    longitude: float
    altitude_km: float | None = None
    velocity_kmh: float | None = None
    visibility: str | None = None
    timestamp: datetime
    source: str


class Launch(BaseModel):
    id: str
    name: str
    status: str | None = None
    net: datetime | None = None
    pad: str | None = None
    location: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    provider: str | None = None
    url: str | None = None
    image_url: str | None = None


class APOD(BaseModel):
    title: str | None = None
    explanation: str | None = None
    url: str | None = None
    hdurl: str | None = None
    media_type: str | None = None
    date: str | None = None
    copyright: str | None = None


class SpaceResponse(ApiMeta):
    iss: ISSPosition | None = None
    launches: list[Launch] = Field(default_factory=list)
    apod: APOD | None = None
    extras: dict[str, Any] = Field(default_factory=dict)
