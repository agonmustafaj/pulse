import { fetchJson } from "../http.js";

const EONET_URL = "https://eonet.gsfc.nasa.gov/api/v3/events";

export async function fetchNaturalEvents(limit = 50) {
  const data = await fetchJson(EONET_URL, { params: { status: "open", limit } });
  const events = [];
  for (const item of data.events || []) {
    const categories = item.categories || [];
    const catTitle = categories[0]?.title || "Natural event";
    const catId = categories[0]?.id || "natural";
    const geometry = item.geometry || [];
    let lat = null;
    let lon = null;
    let timestamp = null;
    if (geometry.length) {
      const g = geometry[geometry.length - 1];
      const coords = g.coordinates || [];
      if (g.type === "Point" && coords.length >= 2) {
        lon = coords[0];
        lat = coords[1];
      }
      if (g.date) {
        const d = new Date(g.date);
        timestamp = Number.isNaN(d.getTime()) ? null : d.toISOString();
      }
    }
    const sources = item.sources || [];
    const sourceUrl = sources[0]?.url || item.link || null;
    events.push({
      id: `eonet-${item.id}`,
      title: item.title || "Natural event",
      description: item.description || null,
      category: "environment",
      latitude: lat,
      longitude: lon,
      location_name: null,
      timestamp,
      source: "NASA EONET",
      source_url: sourceUrl,
      severity: null,
      metadata: { eonet_category: catId, eonet_category_title: catTitle, type: "natural_event" },
    });
  }
  return events;
}
