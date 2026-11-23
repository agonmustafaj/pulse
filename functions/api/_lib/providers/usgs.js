import { fetchJson } from "../http.js";

const FEEDS = {
  significant_week: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson",
  m45_day: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson",
  m25_day: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson",
};

function severity(mag) {
  if (mag == null) return null;
  if (mag >= 6) return "high";
  if (mag >= 4.5) return "medium";
  return "low";
}

export async function fetchEarthquakes(feed = "m45_day") {
  const url = FEEDS[feed] || FEEDS.m45_day;
  const data = await fetchJson(url);
  const events = [];
  for (const feature of data.features || []) {
    const props = feature.properties || {};
    const geom = feature.geometry || {};
    const coords = geom.coordinates || [null, null, null];
    const [lon, lat] = coords;
    const mag = props.mag;
    const ts = props.time;
    const timestamp = ts ? new Date(ts).toISOString() : null;
    const eid = `usgs-${feature.id || props.code}`;
    const place = props.place || "Unknown location";
    const title = mag != null ? `M${mag} — ${place}` : place;
    events.push({
      id: eid,
      title,
      description: props.title || title,
      category: "natural",
      latitude: lat,
      longitude: lon,
      location_name: place,
      timestamp,
      source: "USGS",
      source_url: props.url || null,
      severity: severity(mag),
      metadata: {
        magnitude: mag,
        depth_km: coords.length > 2 ? coords[2] : null,
        felt: props.felt,
        tsunami: props.tsunami,
        alert: props.alert,
        type: "earthquake",
      },
    });
  }
  return events;
}
