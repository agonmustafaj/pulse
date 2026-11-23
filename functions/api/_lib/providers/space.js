import { fetchJson } from "../http.js";

const ISS_URL = "https://api.wheretheiss.at/v1/satellites/25544";
const ISS_FALLBACK = "https://api.open-notify.org/iss-now.json";
const LAUNCHES_URL = "https://ll.thespacedevs.com/2.2.0/launch/upcoming/";
const APOD_URL = "https://api.nasa.gov/planetary/apod";

export async function fetchIss() {
  try {
    const data = await fetchJson(ISS_URL);
    const ts = data.timestamp;
    return {
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      altitude_km: data.altitude != null ? Number(data.altitude) : null,
      velocity_kmh: data.velocity != null ? Number(data.velocity) : null,
      visibility: data.visibility ?? null,
      timestamp: ts ? new Date(ts * 1000).toISOString() : new Date().toISOString(),
      source: "wheretheiss.at",
    };
  } catch {
    const data = await fetchJson(ISS_FALLBACK);
    const pos = data.iss_position || {};
    const ts = data.timestamp;
    return {
      latitude: Number(pos.latitude),
      longitude: Number(pos.longitude),
      altitude_km: null,
      velocity_kmh: null,
      visibility: null,
      timestamp: ts ? new Date(ts * 1000).toISOString() : new Date().toISOString(),
      source: "Open Notify",
    };
  }
}

export async function fetchLaunches(limit = 12) {
  const data = await fetchJson(LAUNCHES_URL, { params: { limit, mode: "detailed" } });
  return (data.results || []).map((item) => {
    const pad = item.pad || {};
    const loc = pad.location || {};
    let net = null;
    if (item.net) {
      const d = new Date(item.net);
      net = Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    let image = null;
    if (item.image) {
      image = typeof item.image === "string" ? item.image : item.image?.image_url || null;
    }
    return {
      id: String(item.id),
      name: item.name || "Launch",
      status: item.status?.name || null,
      net,
      pad: pad.name || null,
      location: loc.name || null,
      latitude: pad.latitude ?? null,
      longitude: pad.longitude ?? null,
      provider: item.launch_service_provider?.name || null,
      url: item.url || null,
      image_url: image,
    };
  });
}

export async function fetchApod(env = {}) {
  const key = env.NASA_API_KEY || "DEMO_KEY";
  try {
    const data = await fetchJson(APOD_URL, { params: { api_key: key } });
    if (data.code || data.error) return null;
    return {
      title: data.title || null,
      explanation: data.explanation || null,
      url: data.url || null,
      hdurl: data.hdurl || null,
      media_type: data.media_type || null,
      date: data.date || null,
      copyright: data.copyright || null,
    };
  } catch {
    return null;
  }
}
