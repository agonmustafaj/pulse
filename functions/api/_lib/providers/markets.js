import { fetchJson } from "../http.js";

const YAHOO_CHART = (symbol) => `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
const COINGECKO_MARKETS = "https://api.coingecko.com/api/v3/coins/markets";
const FRANKFURTER = "https://api.frankfurter.app/latest";

const INDEX_SYMBOLS = [
  { symbol: "^GSPC", name: "S&P 500", category: "index" },
  { symbol: "^DJI", name: "Dow Jones", category: "index" },
  { symbol: "^IXIC", name: "Nasdaq Composite", category: "index" },
  { symbol: "^FTSE", name: "FTSE 100", category: "index" },
  { symbol: "^N225", name: "Nikkei 225", category: "index" },
];

const STOCK_SYMBOLS = [
  { symbol: "AAPL", name: "Apple", category: "stock" },
  { symbol: "MSFT", name: "Microsoft", category: "stock" },
  { symbol: "GOOGL", name: "Alphabet", category: "stock" },
  { symbol: "AMZN", name: "Amazon", category: "stock" },
  { symbol: "NVDA", name: "NVIDIA", category: "stock" },
];

const CRYPTO_IDS = "bitcoin,ethereum,solana,ripple,cardano";
const FX_PAIRS = [
  ["EUR", "Euro / USD"],
  ["GBP", "Pound / USD"],
  ["JPY", "Yen / USD"],
];

const RANGE_MAP = {
  "1d": ["1d", "5m"],
  "1w": ["5d", "1h"],
  "1m": ["1mo", "1d"],
  "3m": ["3mo", "1d"],
  "1y": ["1y", "1wk"],
};

async function yahooQuote(symbol, name, category) {
  try {
    const data = await fetchJson(YAHOO_CHART(symbol), {
      params: { interval: "1d", range: "5d" },
      headers: { "User-Agent": "Mozilla/5.0 PULSE/1.0" },
    });
    const result = data.chart?.result?.[0];
    if (!result) return null;
    const meta = result.meta || {};
    const price = meta.regularMarketPrice;
    const prev = meta.chartPreviousClose ?? meta.previousClose;
    const change = price != null && prev != null ? price - prev : null;
    const pct = change != null && prev ? (change / prev) * 100 : null;
    const ts = meta.regularMarketTime;
    return {
      name,
      symbol,
      price,
      change,
      change_percent: pct,
      currency: meta.currency || "USD",
      category,
      timestamp: ts ? new Date(ts * 1000).toISOString() : new Date().toISOString(),
      source: "Yahoo Finance (delayed)",
      delayed: true,
    };
  } catch {
    return null;
  }
}

export async function fetchYahooInstruments() {
  const items = [];
  for (const spec of [...INDEX_SYMBOLS, ...STOCK_SYMBOLS]) {
    const quote = await yahooQuote(spec.symbol, spec.name, spec.category);
    if (quote) items.push(quote);
  }
  return items;
}

export async function fetchCrypto() {
  try {
    const data = await fetchJson(COINGECKO_MARKETS, {
      params: {
        vs_currency: "usd",
        ids: CRYPTO_IDS,
        order: "market_cap_desc",
        sparkline: "false",
        price_change_percentage: "24h",
      },
    });
    return (data || []).map((coin) => ({
      name: coin.name || coin.id,
      symbol: (coin.symbol || "").toUpperCase(),
      price: coin.current_price,
      change: coin.price_change_24h,
      change_percent: coin.price_change_percentage_24h,
      currency: "USD",
      category: "crypto",
      timestamp: new Date().toISOString(),
      source: "CoinGecko",
      delayed: true,
    }));
  } catch {
    return [];
  }
}

export async function fetchFx() {
  try {
    const data = await fetchJson(FRANKFURTER, { params: { from: "USD", to: "EUR,GBP,JPY" } });
    const rates = data.rates || {};
    const ts = data.date ? new Date(`${data.date}T00:00:00Z`).toISOString() : new Date().toISOString();
    const items = [];
    for (const [code, name] of FX_PAIRS) {
      const rate = rates[code];
      if (rate == null) continue;
      items.push({
        name,
        symbol: `USD${code}`,
        price: rate,
        change: null,
        change_percent: null,
        currency: code,
        category: "fx",
        timestamp: ts,
        source: "Frankfurter / ECB",
        delayed: true,
      });
    }
    return items;
  } catch {
    return [];
  }
}

export async function fetchMarketHistory(symbol, rangeKey = "1m") {
  const [rng, interval] = RANGE_MAP[rangeKey.toLowerCase()] || RANGE_MAP["1m"];
  const cryptoMap = { BTC: "bitcoin", ETH: "ethereum", SOL: "solana", XRP: "ripple", ADA: "cardano" };
  const upper = symbol.toUpperCase().replace(/^\^/, "");
  if (cryptoMap[upper] || Object.values(cryptoMap).includes(symbol.toLowerCase())) {
    const cid = cryptoMap[upper] || symbol.toLowerCase();
    const days = { "1d": 1, "1w": 7, "1m": 30, "3m": 90, "1y": 365 }[rangeKey.toLowerCase()] || 30;
    const data = await fetchJson(`https://api.coingecko.com/api/v3/coins/${cid}/market_chart`, {
      params: { vs_currency: "usd", days },
    });
    const points = (data.prices || []).map((p) => ({ t: Math.floor(p[0]), v: p[1] }));
    return { symbol, range: rangeKey, points, source: "CoinGecko", currency: "USD" };
  }

  if (symbol.toUpperCase().startsWith("USD") && symbol.length === 6) {
    const quote = symbol.toUpperCase().slice(3);
    const days = { "1d": 7, "1w": 7, "1m": 30, "3m": 90, "1y": 365 }[rangeKey.toLowerCase()] || 30;
    const end = new Date();
    const start = new Date(end.getTime() - days * 86400000);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    const data = await fetchJson(`https://api.frankfurter.app/${startStr}..${endStr}`, {
      params: { from: "USD", to: quote },
    });
    const points = Object.entries(data.rates || {}).map(([d, rates]) => ({ t: d, v: rates[quote] }));
    return { symbol, range: rangeKey, points, source: "Frankfurter / ECB", currency: quote };
  }

  const data = await fetchJson(YAHOO_CHART(symbol), {
    params: { interval, range: rng },
    headers: { "User-Agent": "Mozilla/5.0 PULSE/1.0" },
  });
  const result = data.chart?.result?.[0];
  if (!result) {
    return { symbol, range: rangeKey, points: [], source: "Yahoo Finance", currency: "USD" };
  }
  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const points = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (i < closes.length && closes[i] != null) {
      points.push({ t: timestamps[i] * 1000, v: closes[i] });
    }
  }
  const meta = result.meta || {};
  return {
    symbol,
    range: rangeKey,
    points,
    source: "Yahoo Finance (delayed)",
    currency: meta.currency || "USD",
  };
}
