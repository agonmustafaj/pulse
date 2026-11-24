from __future__ import annotations

from datetime import datetime, timezone

from app.schemas.search import SearchResponse, SearchResult
from app.services import events_service, markets_service, news_service, weather_service

MARKET_HINTS = [
    ("sp500", "^GSPC", "S&P 500"),
    ("s&p", "^GSPC", "S&P 500"),
    ("nasdaq", "^IXIC", "Nasdaq"),
    ("bitcoin", "BTC", "Bitcoin"),
    ("btc", "BTC", "Bitcoin"),
    ("ethereum", "ETH", "Ethereum"),
    ("aapl", "AAPL", "Apple"),
    ("nvda", "NVDA", "NVIDIA"),
]


async def search(q: str) -> SearchResponse:
    query = (q or "").strip()
    if len(query) < 2:
        return SearchResponse(
            ok=True,
            source="search",
            updated_at=datetime.now(timezone.utc),
            items=[],
            query=query,
            message="Enter at least 2 characters",
        )

    ql = query.lower()
    results: list[SearchResult] = []

    # Cities
    try:
        cities = await weather_service.search_cities(query)
        for c in cities[:5]:
            label = f"{c['name']}, {c.get('admin1') or ''} {c.get('country') or ''}".strip().replace("  ", " ")
            results.append(
                SearchResult(
                    id=f"city-{c['id']}",
                    title=c["name"],
                    subtitle=label,
                    category="city",
                    route=f"/weather?city={c['name']}",
                    meta={"latitude": c["latitude"], "longitude": c["longitude"]},
                )
            )
    except Exception:  # noqa: BLE001
        pass

    # Events
    try:
        events = await events_service.get_events(limit=200)
        for e in events.items:
            hay = f"{e.title} {e.location_name or ''} {e.category}".lower()
            if ql in hay:
                results.append(
                    SearchResult(
                        id=e.id,
                        title=e.title,
                        subtitle=e.location_name or e.source,
                        category="event",
                        route=f"/signals?id={e.id}",
                        meta={"lat": e.latitude, "lon": e.longitude},
                    )
                )
                if sum(1 for r in results if r.category == "event") >= 8:
                    break
    except Exception:  # noqa: BLE001
        pass

    # News
    try:
        news = await news_service.get_news(query=query, limit=8)
        for a in news.items:
            results.append(
                SearchResult(
                    id=a.id,
                    title=a.headline,
                    subtitle=a.source,
                    category="news",
                    route=f"/news?id={a.id}",
                    meta={"url": a.url},
                )
            )
    except Exception:  # noqa: BLE001
        pass

    # Markets
    for hint, symbol, name in MARKET_HINTS:
        if hint in ql or symbol.lower() in ql:
            results.append(
                SearchResult(
                    id=f"mkt-{symbol}",
                    title=name,
                    subtitle=symbol,
                    category="market",
                    route=f"/markets?symbol={symbol}",
                )
            )

    try:
        markets = await markets_service.get_markets()
        for m in markets.items:
            if ql in m.name.lower() or ql in m.symbol.lower():
                results.append(
                    SearchResult(
                        id=f"mkt-{m.symbol}",
                        title=m.name,
                        subtitle=m.symbol,
                        category="market",
                        route=f"/markets?symbol={m.symbol}",
                    )
                )
    except Exception:  # noqa: BLE001
        pass

    # Static section hints
    for path, title, cat in (
        ("/map", "Global Map", "section"),
        ("/signals", "Live Signals", "section"),
        ("/space", "Orbit — space explorer", "section"),
        ("/", "Explore — galaxy home", "section"),
        ("/analytics", "Analytics", "section"),
    ):
        if ql in title.lower() or ql in path.strip("/"):
            results.append(SearchResult(id=f"sec-{path}", title=title, subtitle="Go to section", category=cat, route=path))

    # de-dupe by id
    seen = set()
    unique = []
    for r in results:
        if r.id in seen:
            continue
        seen.add(r.id)
        unique.append(r)

    return SearchResponse(
        ok=True,
        source=["events", "news", "weather", "markets"],
        updated_at=datetime.now(timezone.utc),
        items=unique[:30],
        query=query,
    )
