from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from time import mktime

import feedparser

from app.config import get_settings
from app.schemas.news import NewsArticle
from app.utils.http import fetch_json, fetch_text

FEEDS = [
    {"url": "https://feeds.bbci.co.uk/news/world/rss.xml", "source": "BBC World", "category": "world"},
    {"url": "https://feeds.bbci.co.uk/news/technology/rss.xml", "source": "BBC Technology", "category": "technology"},
    {"url": "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", "source": "BBC Science", "category": "science"},
    {"url": "https://www.nasa.gov/news-release/feed/", "source": "NASA", "category": "science"},
    {"url": "https://www.theguardian.com/world/rss", "source": "The Guardian", "category": "world"},
    {"url": "https://www.theguardian.com/environment/rss", "source": "The Guardian Environment", "category": "environment"},
    {"url": "https://www.theguardian.com/business/rss", "source": "The Guardian Business", "category": "business"},
]


def _parse_published(entry) -> datetime | None:
    if getattr(entry, "published_parsed", None):
        try:
            return datetime.fromtimestamp(mktime(entry.published_parsed), tz=timezone.utc)
        except Exception:  # noqa: BLE001
            pass
    if getattr(entry, "published", None):
        try:
            return parsedate_to_datetime(entry.published).astimezone(timezone.utc)
        except Exception:  # noqa: BLE001
            return None
    return None


def _article_id(url: str, title: str) -> str:
    raw = f"{url}|{title}".encode()
    return "news-" + hashlib.sha1(raw).hexdigest()[:16]


async def fetch_rss_news(limit_per_feed: int = 12) -> list[NewsArticle]:
    articles: list[NewsArticle] = []
    for feed in FEEDS:
        try:
            xml = await fetch_text(feed["url"])
            parsed = feedparser.parse(xml)
            for entry in parsed.entries[:limit_per_feed]:
                link = getattr(entry, "link", None) or ""
                title = getattr(entry, "title", None) or "Untitled"
                summary = getattr(entry, "summary", None) or getattr(entry, "description", None)
                image = None
                if getattr(entry, "media_thumbnail", None):
                    image = entry.media_thumbnail[0].get("url")
                elif getattr(entry, "media_content", None):
                    image = entry.media_content[0].get("url")
                articles.append(
                    NewsArticle(
                        id=_article_id(link, title),
                        headline=title,
                        description=summary[:400] if summary else None,
                        source=feed["source"],
                        published=_parse_published(entry),
                        category=feed["category"],
                        url=link,
                        image_url=image,
                    )
                )
        except Exception:  # noqa: BLE001: skip failed feed
            continue
    articles.sort(key=lambda a: a.published or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return articles


async def fetch_newsapi(query: str | None = None, category: str | None = None) -> list[NewsArticle]:
    settings = get_settings()
    if not settings.news_api_key:
        return []
    params: dict = {"apiKey": settings.news_api_key, "pageSize": 30, "language": "en"}
    if query:
        params["q"] = query
        url = "https://newsapi.org/v2/everything"
    else:
        params["country"] = "us"
        if category:
            params["category"] = category
        url = "https://newsapi.org/v2/top-headlines"
    data = await fetch_json(url, params=params)
    articles: list[NewsArticle] = []
    for item in data.get("articles") or []:
        link = item.get("url") or ""
        title = item.get("title") or "Untitled"
        published = None
        if item.get("publishedAt"):
            try:
                published = datetime.fromisoformat(item["publishedAt"].replace("Z", "+00:00"))
            except ValueError:
                published = None
        articles.append(
            NewsArticle(
                id=_article_id(link, title),
                headline=title,
                description=item.get("description"),
                source=(item.get("source") or {}).get("name") or "NewsAPI",
                published=published,
                category=category or "world",
                url=link,
                image_url=item.get("urlToImage"),
            )
        )
    return articles
