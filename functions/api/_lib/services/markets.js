import { cacheGet, cacheSet } from "../cache.js";
import {
  fetchYahooInstruments,
  fetchCrypto,
  fetchFx,
  fetchMarketHistory,
} from "../providers/markets.js";

const CACHE_KEY = "markets:all";
const TTL = 180;

export async function getMarkets({ category } = {}) {
  let resp;
  const cached = await cacheGet(CACHE_KEY);
  if (cached) {
    resp = { ...cached, cached: true };
  } else {
    const items = [];
    const sources = [];
    for (const [fetcher, label] of [
      [fetchYahooInstruments, "Yahoo Finance"],
      [fetchCrypto, "CoinGecko"],
      [fetchFx, "Frankfurter"],
    ]) {
      try {
        const batch = await fetcher();
        items.push(...batch);
        if (batch.length) sources.push(label);
      } catch {
        /* continue */
      }
    }
    resp = {
      ok: Boolean(items.length),
      source: sources.length ? sources : ["markets"],
      updated_at: new Date().toISOString(),
      cached: false,
      items,
      message: items.length ? null : "No market data available right now",
      disclaimer: "Informational only. Not financial advice. Prices may be delayed.",
    };
    await cacheSet(CACHE_KEY, resp, TTL);
  }

  if (category) {
    return { ...resp, items: (resp.items || []).filter((i) => i.category === category) };
  }
  return resp;
}

export async function getHistory(symbol, rangeKey = "1m") {
  const cacheKey = `markets:hist:${symbol}:${rangeKey}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;
  const hist = await fetchMarketHistory(symbol, rangeKey);
  await cacheSet(cacheKey, hist, 300);
  return hist;
}
