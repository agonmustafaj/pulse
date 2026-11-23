from datetime import datetime

from pydantic import BaseModel, Field

from .common import ApiMeta


class NewsArticle(BaseModel):
    id: str
    headline: str
    description: str | None = None
    source: str
    published: datetime | None = None
    category: str = "world"
    url: str
    image_url: str | None = None
    location: str | None = None


class NewsResponse(ApiMeta):
    items: list[NewsArticle] = Field(default_factory=list)
    total: int = 0
