import { cacheGet, cacheSet } from "../cache.js";
import { fetchEarthquakes } from "../providers/usgs.js";
import { fetchNaturalEvents } from "../providers/eonet.js";

const CACHE_KEY = "events:all";
const TTL = 300;

export async function getEvents({ category, limit = 100, region } = {}) {
  let items;
  let sources;
  let updated;
  let metaCached = false;

  const cached = await cacheGet(CACHE_KEY);
  if (cached) {
    items = cached.items;
    sources = cached.source;
    updated = cached.updated_at;
    metaCached = true;
  } else {
    items = [];
    sources = [];
    const errors = [];
    try {
      const quakes = await fetchEarthquakes("m45_day");
      items.push(...quakes);
      sources.push("USGS");
    } catch (exc) {
      errors.push(`USGS: ${exc.message || exc}`);
    }
    try {
      const natural = await fetchNaturalEvents(40);
      items.push(...natural);
      sources.push("NASA EONET");
    } catch (exc) {
      errors.push(`EONET: ${exc.message || exc}`);
    }
    try {
      const significant = await fetchEarthquakes("significant_week");
      const existing = new Set(items.map((e) => e.id));
      for (const e of significant) {
        if (!existing.has(e.id)) items.push(e);
      }
      if (!sources.includes("USGS")) sources.push("USGS");
    } catch {
      /* optional */
    }
    items.sort((a, b) => {
      const ta = a.timestamp ? Date.parse(a.timestamp) : 0;
      const tb = b.timestamp ? Date.parse(b.timestamp) : 0;
      return tb - ta;
    });
    updated = new Date().toISOString();
    await cacheSet(CACHE_KEY, { items, source: sources, updated_at: updated }, TTL);
    if (errors.length && !items.length) {
      return {
        ok: false,
        source: sources.length ? sources : "events",
        updated_at: updated,
        cached: false,
        message: errors.join("; "),
        items: [],
        total: 0,
      };
    }
  }

  if (category) {
    const c = category.toLowerCase();
    items = items.filter((e) => e.category.toLowerCase() === c || e.metadata?.type === category);
  }
  if (region) {
    const r = region.toLowerCase();
    items = items.filter((e) => e.location_name && e.location_name.toLowerCase().includes(r));
  }

  const capped = Math.max(1, Math.min(Number(limit) || 100, 500));
  const limited = items.slice(0, capped);
  return {
    ok: true,
    source: sources,
    updated_at: updated,
    cached: metaCached,
    items: limited,
    total: items.length,
  };
}

export async function getEvent(eventId) {
  const resp = await getEvents({ limit: 500 });
  return resp.items.find((e) => e.id === eventId) || null;
}
