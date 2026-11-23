from typing import Any

from pydantic import BaseModel, Field

from .common import ApiMeta


class SearchResult(BaseModel):
    id: str
    title: str
    subtitle: str | None = None
    category: str
    route: str
    meta: dict[str, Any] = Field(default_factory=dict)


class SearchResponse(ApiMeta):
    items: list[SearchResult] = Field(default_factory=list)
    query: str = ""
