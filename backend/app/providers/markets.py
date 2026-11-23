from __future__ import annotations

from datetime import datetime, timezone

from app.schemas.markets import MarketHistory, MarketInstrument
from app.utils.http import fetch_json

YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
COINGECKO_MARKETS = "https://api.coingecko.com/api/v3/coins/markets"
FRANKFURTER = "https://api.frankfurter.app/latest"

INDEX_SYMBOLS = [
    {"symbol": "^GSPC", "name": "S&P 500", "category": "index"},
    {"symbol": "^DJI", "name": "Dow Jones", "category": "index"},
    {"symbol": "^IXIC", "name": "Nasdaq Composite", "category": "index"},
    {"symbol": "^FTSE", "name": "FTSE 100", "category": "index"},
    {"symbol": "^N225", "name": "Nikkei 225", "category": "index"},
]

STOCK_SYMBOLS = [
    {"symbol": "AAPL", "name": "Apple", "category": "stock"},
    {"symbol": "MSFT", "name": "Microsoft", "category": "stock"},
    {"symbol": "GOOGL", "name": "Alphabet", "category": "stock"},
    {"symbol": "AMZN", "name": "Amazon", "category": "stock"},
    {"symbol": "NVDA", "name": "NVIDIA", "category": "stock"},
]

CRYPTO_IDS = "bitcoin,ethereum,solana,ripple,cardano"

FX_PAIRS = [("EUR", "Euro / USD"), ("GBP", "Pound / USD"), ("JPY", "Yen / USD")]

RANGE_MAP = {
    "1d": ("1d", "5m"),
    "1w": ("5d", "1h"),
    "1m": ("1mo", "1d"),
    "3m": ("3mo", "1d"),
    "1y": ("1y", "1wk"),
}


async def _yahoo_quote(symbol: str, name: str, category: str) -> MarketInstrument | None:
    try:
        data = await fetch_json(
            YAHOO_CHART.format(symbol=symbol),
            params={"interval": "1d", "range": "5d"},
            headers={"User-Agent": "Mozilla/5.0 PULSE/1.0"},
        )
        result = ((data.get("chart") or {}).get("result") or [None])[0]
        if not result:
            return None
        meta = result.get("meta") or {}
        price = meta.get("regularMarketPrice")
        prev = meta.get("chartPreviousClose") or meta.get("previousClose")
        change = (price - prev) if price is not None and prev is not None else None
        pct = (change / prev * 100) if change is not None and prev else None
        ts = meta.get("regularMarketTime")
        timestamp = datetime.fromtimestamp(ts, tz=timezone.utc) if ts else datetime.now(timezone.utc)
        return MarketInstrument(
            name=name,
            symbol=symbol,
            price=price,
            change=change,
            change_percent=pct,
            currency=meta.get("currency") or "USD",
            category=category,
            timestamp=timestamp,
            source="Yahoo Finance (delayed)",
            delayed=True,
        )
    except Exception:  # noqa: BLE001
        return None


async def fetch_yahoo_instruments() -> list[MarketInstrument]:
    items: list[MarketInstrument] = []
    for spec in INDEX_SYMBOLS + STOCK_SYMBOLS:
        quote = await _yahoo_quote(spec["symbol"], spec["name"], spec["category"])
        if quote:
            items.append(quote)
    return items


async def fetch_crypto() -> list[MarketInstrument]:
    try:
        data = await fetch_json(
            COINGECKO_MARKETS,
            params={
                "vs_currency": "usd",
                "ids": CRYPTO_IDS,
                "order": "market_cap_desc",
                "sparkline": "false",
                "price_change_percentage": "24h",
            },
        )
    except Exception:  # noqa: BLE001
        return []
    items: list[MarketInstrument] = []
    for coin in data:
        items.append(
            MarketInstrument(
                name=coin.get("name") or coin.get("id"),
                symbol=(coin.get("symbol") or "").upper(),
                price=coin.get("current_price"),
                change=coin.get("price_change_24h"),
                change_percent=coin.get("price_change_percentage_24h"),
                currency="USD",
                category="crypto",
                timestamp=datetime.now(timezone.utc),
                source="CoinGecko",
                delayed=True,
            )
        )
    return items


async def fetch_fx() -> list[MarketInstrument]:
    try:
        data = await fetch_json(FRANKFURTER, params={"from": "USD", "to": "EUR,GBP,JPY"})
    except Exception:  # noqa: BLE001
        return []
    rates = data.get("rates") or {}
    date = data.get("date")
    ts = datetime.fromisoformat(date).replace(tzinfo=timezone.utc) if date else datetime.now(timezone.utc)
    items: list[MarketInstrument] = []
    for code, name in FX_PAIRS:
        rate = rates.get(code)
        if rate is None:
            continue
        # Express as foreign per USD and also inverse for display consistency
        items.append(
            MarketInstrument(
                name=name,
                symbol=f"USD{code}",
                price=rate,
                change=None,
                change_percent=None,
                currency=code,
                category="fx",
                timestamp=ts,
                source="Frankfurter / ECB",
                delayed=True,
            )
        )
    return items


async def fetch_market_history(symbol: str, range_key: str = "1m") -> MarketHistory:
    rng, interval = RANGE_MAP.get(range_key.lower(), RANGE_MAP["1m"])
    # Crypto via CoinGecko
    crypto_map = {"BTC": "bitcoin", "ETH": "ethereum", "SOL": "solana", "XRP": "ripple", "ADA": "cardano"}
    upper = symbol.upper().lstrip("^")
    if upper in crypto_map or symbol.lower() in crypto_map.values():
        cid = crypto_map.get(upper, symbol.lower())
        days = {"1d": 1, "1w": 7, "1m": 30, "3m": 90, "1y": 365}.get(range_key.lower(), 30)
        data = await fetch_json(f"https://api.coingecko.com/api/v3/coins/{cid}/market_chart", params={"vs_currency": "usd", "days": days})
        points = [{"t": int(p[0]), "v": p[1]} for p in (data.get("prices") or [])]
        return MarketHistory(symbol=symbol, range=range_key, points=points, source="CoinGecko", currency="USD")

    # FX via Frankfurter
    if symbol.upper().startswith("USD") and len(symbol) == 6:
        quote = symbol.upper()[3:]
        end = datetime.now(timezone.utc).date()
        days = {"1d": 7, "1w": 7, "1m": 30, "3m": 90, "1y": 365}.get(range_key.lower(), 30)
        from datetime import timedelta

        start = end - timedelta(days=days)
        data = await fetch_json(
            f"https://api.frankfurter.app/{start}..{end}",
            params={"from": "USD", "to": quote},
        )
        points = []
        for d, rates in (data.get("rates") or {}).items():
            points.append({"t": d, "v": rates.get(quote)})
        return MarketHistory(symbol=symbol, range=range_key, points=points, source="Frankfurter / ECB", currency=quote)

    data = await fetch_json(
        YAHOO_CHART.format(symbol=symbol),
        params={"interval": interval, "range": rng},
        headers={"User-Agent": "Mozilla/5.0 PULSE/1.0"},
    )
    result = ((data.get("chart") or {}).get("result") or [None])[0]
    if not result:
        return MarketHistory(symbol=symbol, range=range_key, points=[], source="Yahoo Finance", currency="USD")
    timestamps = result.get("timestamp") or []
    quote = (result.get("indicators") or {}).get("quote") or [{}]
    closes = (quote[0] or {}).get("close") or []
    points = []
    for i, t in enumerate(timestamps):
        if i < len(closes) and closes[i] is not None:
            points.append({"t": t * 1000, "v": closes[i]})
    meta = result.get("meta") or {}
    return MarketHistory(
        symbol=symbol,
        range=range_key,
        points=points,
        source="Yahoo Finance (delayed)",
        currency=meta.get("currency") or "USD",
    )
