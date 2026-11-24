import { getEvents } from "./events.js";
import { getNews } from "./news.js";
import { getMarkets } from "./markets.js";
import { searchCities } from "./weather.js";

const MARKET_HINTS = [
  ["sp500", "^GSPC", "S&P 500"],
  ["s&p", "^GSPC", "S&P 500"],
  ["nasdaq", "^IXIC", "Nasdaq"],
  ["bitcoin", "BTC", "Bitcoin"],
  ["btc", "BTC", "Bitcoin"],
  ["ethereum", "ETH", "Ethereum"],
  ["aapl", "AAPL", "Apple"],
  ["nvda", "NVDA", "NVIDIA"],
];

export async function search(env, q) {
  const query = (q || "").trim();
  if (query.length < 2) {
    return {
      ok: true,
      source: "search",
      updated_at: new Date().toISOString(),
      items: [],
      query,
      message: "Enter at least 2 characters",
    };
  }

  const ql = query.toLowerCase();
  const results = [];

  try {
    const cities = await searchCities(query);
    for (const c of cities.slice(0, 5)) {
      const label = `${c.name}, ${c.admin1 || ""} ${c.country || ""}`.replace(/\s+/g, " ").trim();
      results.push({
        id: `city-${c.id}`,
        title: c.name,
        subtitle: label,
        category: "city",
        route: `/weather?city=${c.name}`,
        meta: { latitude: c.latitude, longitude: c.longitude },
      });
    }
  } catch {
    /* optional */
  }

  try {
    const events = await getEvents({ limit: 200 });
    let eventCount = 0;
    for (const e of events.items) {
      const hay = `${e.title} ${e.location_name || ""} ${e.category}`.toLowerCase();
      if (hay.includes(ql)) {
        results.push({
          id: e.id,
          title: e.title,
          subtitle: e.location_name || e.source,
          category: "event",
          route: `/signals?id=${e.id}`,
          meta: { lat: e.latitude, lon: e.longitude },
        });
        eventCount += 1;
        if (eventCount >= 8) break;
      }
    }
  } catch {
    /* optional */
  }

  try {
    const news = await getNews(env, { query, limit: 8 });
    for (const a of news.items) {
      results.push({
        id: a.id,
        title: a.headline,
        subtitle: a.source,
        category: "news",
        route: `/news?id=${a.id}`,
        meta: { url: a.url },
      });
    }
  } catch {
    /* optional */
  }

  for (const [hint, symbol, name] of MARKET_HINTS) {
    if (ql.includes(hint) || ql.includes(symbol.toLowerCase())) {
      results.push({
        id: `mkt-${symbol}`,
        title: name,
        subtitle: symbol,
        category: "market",
        route: `/markets?symbol=${symbol}`,
        meta: {},
      });
    }
  }

  try {
    const markets = await getMarkets();
    for (const m of markets.items || []) {
      if (m.name.toLowerCase().includes(ql) || m.symbol.toLowerCase().includes(ql)) {
        results.push({
          id: `mkt-${m.symbol}`,
          title: m.name,
          subtitle: m.symbol,
          category: "market",
          route: `/markets?symbol=${m.symbol}`,
          meta: {},
        });
      }
    }
  } catch {
    /* optional */
  }

  for (const [path, title, cat] of [
    ["/map", "Global Map", "section"],
    ["/signals", "Live Signals", "section"],
    ["/space", "Space Explorer", "section"],
    ["/analytics", "Analytics", "section"],
  ]) {
    if (ql.includes(title.toLowerCase()) || ql.includes(path.replace("/", ""))) {
      results.push({
        id: `sec-${path}`,
        title,
        subtitle: "Go to section",
        category: cat,
        route: path,
        meta: {},
      });
    }
  }

  const seen = new Set();
  const unique = [];
  for (const r of results) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    unique.push(r);
  }

  return {
    ok: true,
    source: ["events", "news", "weather", "markets"],
    updated_at: new Date().toISOString(),
    items: unique.slice(0, 30),
    query,
  };
}
