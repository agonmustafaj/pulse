import { getEvents } from "./events.js";
import { getNews } from "./news.js";

function regionBucket(lat, lon, location) {
  if (location) {
    const lower = location.toLowerCase();
    const pairs = [
      ["japan", "East Asia"],
      ["china", "East Asia"],
      ["indonesia", "SE Asia"],
      ["alaska", "North America"],
      ["california", "North America"],
      ["mexico", "North America"],
      ["chile", "South America"],
      ["peru", "South America"],
      ["italy", "Europe"],
      ["greece", "Europe"],
      ["turkey", "Europe/W Asia"],
      ["iran", "Middle East"],
      ["new zealand", "Oceania"],
      ["vanuatu", "Oceania"],
      ["fiji", "Oceania"],
    ];
    for (const [key, label] of pairs) {
      if (lower.includes(key)) return label;
    }
  }
  if (lat == null || lon == null) return "Unknown";
  if (lat >= 0 && lon >= -30 && lon < 60) return "Europe / Africa";
  if (lat >= 0 && lon >= 60) return "Asia";
  if (lat >= 0 && lon < -30) return "North America";
  if (lat < 0 && lon < -30) return "South America";
  if (lat < 0 && lon >= 100) return "Oceania";
  return "Other";
}

function counterEntries(counter) {
  return Object.entries(counter)
    .map(([k, v]) => ({ key: k, count: v }))
    .sort((a, b) => b.count - a.count);
}

export async function getAnalytics(env) {
  const events = await getEvents({ limit: 500 });
  const news = await getNews(env, { limit: 100 });

  const catCounter = {};
  const regionCounter = {};
  const dayCounter = {};

  for (const e of events.items) {
    catCounter[e.category] = (catCounter[e.category] || 0) + 1;
    const region = regionBucket(e.latitude, e.longitude, e.location_name);
    regionCounter[region] = (regionCounter[region] || 0) + 1;
    if (e.timestamp) {
      const day = e.timestamp.slice(0, 10);
      dayCounter[day] = (dayCounter[day] || 0) + 1;
    }
  }

  const newsCats = {};
  for (const a of news.items) {
    newsCats[a.category] = (newsCats[a.category] || 0) + 1;
  }

  const byCategory = counterEntries(catCounter).map(({ key, count }) => ({ category: key, count }));
  const byRegion = counterEntries(regionCounter).map(({ key, count }) => ({ region: key, count }));
  const timeline = Object.keys(dayCounter)
    .sort()
    .map((d) => ({ date: d, count: dayCounter[d] }));

  const eventSources = Array.isArray(events.source) ? events.source : [events.source];

  return {
    ok: true,
    source: [...new Set([...eventSources, "derived"])],
    updated_at: new Date().toISOString(),
    cached: events.cached,
    by_category: byCategory,
    by_region: byRegion,
    timeline,
    totals: {
      events: events.total,
      news: news.total,
      news_by_category: newsCats,
      earthquakes: events.items.filter((e) => e.metadata?.type === "earthquake").length,
      natural_events: events.items.filter((e) => e.metadata?.type === "natural_event").length,
    },
  };
}
