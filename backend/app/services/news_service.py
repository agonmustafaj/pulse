from __future__ import annotations

from datetime import datetime, timezone

from app.cache import cache
from app.providers import rss_news
from app.schemas.news import NewsArticle, NewsResponse

CACHE_KEY = "news:all"
TTL = 900


async def get_news(
    category: str | None = None,
    query: str | None = None,
    source: str | None = None,
    limit: int = 50,
) -> NewsResponse:
    cached = await cache.get(CACHE_KEY)
    if cached:
        items = [NewsArticle.model_validate(a) for a in cached["items"]]
        updated = datetime.fromisoformat(cached["updated_at"])
        sources = cached["source"]
        is_cached = True
    else:
        items = await rss_news.fetch_rss_news()
        try:
            extra = await rss_news.fetch_newsapi()
            items.extend(extra)
        except Exception:  # noqa: BLE001
            pass
        # de-dupe by url
        seen = set()
        unique: list[NewsArticle] = []
        for a in items:
            if a.url in seen:
                continue
            seen.add(a.url)
            unique.append(a)
        items = unique
        updated = datetime.now(timezone.utc)
        sources = sorted({a.source for a in items}) or ["RSS"]
        await cache.set(
            CACHE_KEY,
            {"items": [a.model_dump(mode="json") for a in items], "source": sources, "updated_at": updated.isoformat()},
            TTL,
        )
        is_cached = False

    if category:
        items = [a for a in items if a.category.lower() == category.lower()]
    if source:
        items = [a for a in items if source.lower() in a.source.lower()]
    if query:
        q = query.lower()
        items = [
            a
            for a in items
            if q in a.headline.lower() or (a.description and q in a.description.lower())
        ]

    return NewsResponse(
        ok=True,
        source=sources,
        updated_at=updated,
        cached=is_cached,
        items=items[: max(1, min(limit, 200))],
        total=len(items),
    )
