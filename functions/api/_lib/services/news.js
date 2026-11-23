import { cacheGet, cacheSet } from "../cache.js";
import { fetchRssNews, fetchNewsApi } from "../providers/news.js";

const CACHE_KEY = "news:all";
const TTL = 900;

export async function getNews(env, { category, query, source, limit = 50 } = {}) {
  let items;
  let sources;
  let updated;
  let isCached = false;

  const cached = await cacheGet(CACHE_KEY);
  if (cached) {
    items = cached.items;
    sources = cached.source;
    updated = cached.updated_at;
    isCached = true;
  } else {
    items = await fetchRssNews();
    try {
      const extra = await fetchNewsApi(env);
      items.push(...extra);
    } catch {
      /* optional */
    }
    const seen = new Set();
    const unique = [];
    for (const a of items) {
      if (seen.has(a.url)) continue;
      seen.add(a.url);
      unique.push(a);
    }
    items = unique;
    updated = new Date().toISOString();
    sources = [...new Set(items.map((a) => a.source))].sort();
    if (!sources.length) sources = ["RSS"];
    await cacheSet(CACHE_KEY, { items, source: sources, updated_at: updated }, TTL);
  }

  if (category) {
    items = items.filter((a) => a.category.toLowerCase() === category.toLowerCase());
  }
  if (source) {
    items = items.filter((a) => a.source.toLowerCase().includes(source.toLowerCase()));
  }
  if (query) {
    const q = query.toLowerCase();
    items = items.filter(
      (a) => a.headline.toLowerCase().includes(q) || (a.description && a.description.toLowerCase().includes(q))
    );
  }

  const capped = Math.max(1, Math.min(Number(limit) || 50, 200));
  return {
    ok: true,
    source: sources,
    updated_at: updated,
    cached: isCached,
    items: items.slice(0, capped),
    total: items.length,
  };
}
