from typing import Any

from pydantic import BaseModel, Field

from .common import ApiMeta


class AnalyticsResponse(ApiMeta):
    by_category: list[dict[str, Any]] = Field(default_factory=list)
    by_region: list[dict[str, Any]] = Field(default_factory=list)
    timeline: list[dict[str, Any]] = Field(default_factory=list)
    totals: dict[str, Any] = Field(default_factory=dict)
