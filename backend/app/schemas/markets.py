from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from .common import ApiMeta


class MarketInstrument(BaseModel):
    name: str
    symbol: str
    price: float | None = None
    change: float | None = None
    change_percent: float | None = None
    currency: str = "USD"
    category: str = "index"
    timestamp: datetime | None = None
    source: str
    delayed: bool = True


class MarketHistory(BaseModel):
    symbol: str
    range: str
    points: list[dict[str, Any]] = Field(default_factory=list)
    source: str
    currency: str = "USD"


class MarketsResponse(ApiMeta):
    items: list[MarketInstrument] = Field(default_factory=list)
    disclaimer: str = "Informational only. Not financial advice. Prices may be delayed."
