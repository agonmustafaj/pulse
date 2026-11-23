from __future__ import annotations

from datetime import datetime, timezone

from app.cache import cache
from app.providers import markets as markets_provider
from app.schemas.markets import MarketHistory, MarketsResponse

CACHE_KEY = "markets:all"
TTL = 180


async def get_markets(category: str | None = None) -> MarketsResponse:
    cached = await cache.get(CACHE_KEY)
    if cached:
        resp = MarketsResponse.model_validate({**cached, "cached": True})
    else:
        items = []
        sources: list[str] = []
        for fetcher, label in (
            (markets_provider.fetch_yahoo_instruments, "Yahoo Finance"),
            (markets_provider.fetch_crypto, "CoinGecko"),
            (markets_provider.fetch_fx, "Frankfurter"),
        ):
            try:
                batch = await fetcher()
                items.extend(batch)
                if batch:
                    sources.append(label)
            except Exception:  # noqa: BLE001
                continue
        resp = MarketsResponse(
            ok=bool(items),
            source=sources or ["markets"],
            updated_at=datetime.now(timezone.utc),
            cached=False,
            items=items,
            message=None if items else "No market data available right now",
        )
        await cache.set(CACHE_KEY, resp.model_dump(mode="json"), TTL)

    if category:
        filtered = [i for i in resp.items if i.category == category]
        return resp.model_copy(update={"items": filtered})
    return resp


async def get_history(symbol: str, range_key: str = "1m") -> MarketHistory:
    cache_key = f"markets:hist:{symbol}:{range_key}"
    cached = await cache.get(cache_key)
    if cached:
        return MarketHistory.model_validate(cached)
    hist = await markets_provider.fetch_market_history(symbol, range_key)
    await cache.set(cache_key, hist.model_dump(mode="json"), 300)
    return hist
