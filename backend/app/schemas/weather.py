from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from .common import ApiMeta


class WeatherCurrent(BaseModel):
    location: str
    latitude: float
    longitude: float
    temperature_c: float | None = None
    feels_like_c: float | None = None
    humidity: float | None = None
    wind_speed_kmh: float | None = None
    wind_direction: float | None = None
    visibility_m: float | None = None
    pressure_hpa: float | None = None
    condition: str | None = None
    weather_code: int | None = None
    timezone: str | None = None
    local_time: str | None = None
    aqi: float | None = None
    updated: datetime | None = None


class WeatherForecast(BaseModel):
    hourly: list[dict[str, Any]] = Field(default_factory=list)
    daily: list[dict[str, Any]] = Field(default_factory=list)


class WeatherResponse(ApiMeta):
    current: WeatherCurrent | None = None
    forecast: WeatherForecast | None = None
