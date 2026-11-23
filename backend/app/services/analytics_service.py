from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timezone

from app.schemas.analytics import AnalyticsResponse
from app.services import events_service, news_service


def _region_bucket(lat: float | None, lon: float | None, location: str | None) -> str:
    if location:
        # crude keyword buckets from place names
        lower = location.lower()
        for key, label in (
            ("japan", "East Asia"),
            ("china", "East Asia"),
            ("indonesia", "SE Asia"),
            ("alaska", "North America"),
            ("california", "North America"),
            ("mexico", "North America"),
            ("chile", "South America"),
            ("peru", "South America"),
            ("italy", "Europe"),
            ("greece", "Europe"),
            ("turkey", "Europe/W Asia"),
            ("iran", "Middle East"),
            ("new zealand", "Oceania"),
            ("vanuatu", "Oceania"),
            ("fiji", "Oceania"),
        ):
            if key in lower:
                return label
    if lat is None or lon is None:
        return "Unknown"
    if lat >= 0 and -30 <= lon < 60:
        return "Europe / Africa"
    if lat >= 0 and lon >= 60:
        return "Asia"
    if lat >= 0 and lon < -30:
        return "North America"
    if lat < 0 and lon < -30:
        return "South America"
    if lat < 0 and lon >= 100:
        return "Oceania"
    return "Other"


async def get_analytics() -> AnalyticsResponse:
    events = await events_service.get_events(limit=500)
    news = await news_service.get_news(limit=100)

    cat_counter: Counter[str] = Counter()
    region_counter: Counter[str] = Counter()
    day_counter: Counter[str] = Counter()

    for e in events.items:
        cat_counter[e.category] += 1
        region_counter[_region_bucket(e.latitude, e.longitude, e.location_name)] += 1
        if e.timestamp:
            day_counter[e.timestamp.astimezone(timezone.utc).strftime("%Y-%m-%d")] += 1

    news_cats: Counter[str] = Counter(a.category for a in news.items)

    by_category = [{"category": k, "count": v} for k, v in cat_counter.most_common()]
    by_region = [{"region": k, "count": v} for k, v in region_counter.most_common()]
    timeline = [{"date": d, "count": day_counter[d]} for d in sorted(day_counter.keys())]

    return AnalyticsResponse(
        ok=True,
        source=list({*(events.source if isinstance(events.source, list) else [events.source]), "derived"}),
        updated_at=datetime.now(timezone.utc),
        cached=events.cached,
        by_category=by_category,
        by_region=by_region,
        timeline=timeline,
        totals={
            "events": events.total,
            "news": news.total,
            "news_by_category": dict(news_cats),
            "earthquakes": sum(1 for e in events.items if (e.metadata or {}).get("type") == "earthquake"),
            "natural_events": sum(1 for e in events.items if (e.metadata or {}).get("type") == "natural_event"),
        },
    )
