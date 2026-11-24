import { fetchJson } from "../http.js";

const ISS_URL = "https://api.wheretheiss.at/v1/satellites/25544";
const ISS_FALLBACK = "https://api.open-notify.org/iss-now.json";
const LAUNCHES_URL = "https://ll.thespacedevs.com/2.2.0/launch/upcoming/";
const APOD_URL = "https://api.nasa.gov/planetary/apod";
const NEO_FEED_URL = "https://api.nasa.gov/neo/rest/v1/feed";

/** JPL SSD planetary mean elements (Keplerian), valid ~1800–2050.
 *  Source: https://ssd.jpl.nasa.gov/planets/approx_pos.html
 *  a (AU), e, I (deg), L (deg), ϖ (deg), Ω (deg) + rates per century.
 */
const PLANET_ELEMENTS = [
  {
    id: "mercury",
    name: "Mercury",
    color: "#b0b0b0",
    a: 0.38709927,
    e: 0.20563593,
    I: 7.00497902,
    L: 252.2503235,
    wbar: 77.45779628,
    Omega: 48.33076593,
    aDot: 0.00000037,
    eDot: 0.00001906,
    IDot: -0.00594749,
    LDot: 149472.67411175,
    wbarDot: 0.16047689,
    OmegaDot: -0.12534081,
  },
  {
    id: "venus",
    name: "Venus",
    color: "#e8cda0",
    a: 0.72333566,
    e: 0.00677672,
    I: 3.39467605,
    L: 181.9790995,
    wbar: 131.60246718,
    Omega: 76.67984255,
    aDot: 0.0000039,
    eDot: -0.00004107,
    IDot: -0.0007889,
    LDot: 58517.81538729,
    wbarDot: 0.00268329,
    OmegaDot: -0.27769418,
  },
  {
    id: "earth",
    name: "Earth",
    color: "#4ea8de",
    a: 1.00000261,
    e: 0.01671123,
    I: -0.00001531,
    L: 100.46457166,
    wbar: 102.93768193,
    Omega: 0.0,
    aDot: 0.00000562,
    eDot: -0.00004392,
    IDot: -0.01294668,
    LDot: 35999.37244981,
    wbarDot: 0.32327364,
    OmegaDot: 0.0,
  },
  {
    id: "mars",
    name: "Mars",
    color: "#c1440e",
    a: 1.52371034,
    e: 0.0933941,
    I: 1.84969142,
    L: -4.55343205,
    wbar: -23.94362959,
    Omega: 49.55953891,
    aDot: 0.00001847,
    eDot: 0.00007882,
    IDot: -0.00813131,
    LDot: 19140.30268499,
    wbarDot: 0.44441088,
    OmegaDot: -0.29257343,
  },
  {
    id: "jupiter",
    name: "Jupiter",
    color: "#c88b3a",
    a: 5.202887,
    e: 0.04838624,
    I: 1.30439695,
    L: 34.39644051,
    wbar: 14.72847983,
    Omega: 100.47390909,
    aDot: -0.00011607,
    eDot: -0.00013253,
    IDot: -0.00183714,
    LDot: 3034.74612775,
    wbarDot: 0.21252668,
    OmegaDot: 0.20469106,
  },
  {
    id: "saturn",
    name: "Saturn",
    color: "#e6d5a8",
    a: 9.53667594,
    e: 0.05386179,
    I: 2.48599187,
    L: 49.95424423,
    wbar: 92.59887831,
    Omega: 113.66242448,
    aDot: -0.0012506,
    eDot: -0.00050991,
    IDot: 0.00193609,
    LDot: 1222.49362201,
    wbarDot: -0.41897216,
    OmegaDot: -0.28867794,
  },
  {
    id: "uranus",
    name: "Uranus",
    color: "#7ec8e3",
    a: 19.18916464,
    e: 0.04725744,
    I: 0.77263783,
    L: 313.23218,
    wbar: 170.9542763,
    Omega: 74.01692503,
    aDot: -0.00196176,
    eDot: -0.00004397,
    IDot: -0.00242939,
    LDot: 428.48202785,
    wbarDot: 0.40805281,
    OmegaDot: 0.04240589,
  },
  {
    id: "neptune",
    name: "Neptune",
    color: "#4166f5",
    a: 30.06992276,
    e: 0.00859048,
    I: 1.77004347,
    L: -55.12002969,
    wbar: 44.96476227,
    Omega: 131.78405702,
    aDot: 0.00026291,
    eDot: 0.00005105,
    IDot: 0.00035372,
    LDot: 218.45945325,
    wbarDot: -0.32241464,
    OmegaDot: -0.00508664,
  },
];

const DEG2RAD = Math.PI / 180;

function julianCenturiesFromJ2000(date = new Date()) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  return (jd - 2451545.0) / 36525.0;
}

function wrap360(deg) {
  let x = deg % 360;
  if (x < 0) x += 360;
  return x;
}

function eccentricAnomaly(Mdeg, e) {
  let M = wrap360(Mdeg) * DEG2RAD;
  if (M > Math.PI) M -= 2 * Math.PI;
  let E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
  for (let i = 0; i < 8; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-8) break;
  }
  return E;
}

function helioXY(planet, T) {
  const a = planet.a + planet.aDot * T;
  const e = planet.e + planet.eDot * T;
  const I = (planet.I + planet.IDot * T) * DEG2RAD;
  const L = planet.L + planet.LDot * T;
  const wbar = planet.wbar + planet.wbarDot * T;
  const Omega = (planet.Omega + planet.OmegaDot * T) * DEG2RAD;
  const w = (wbar - planet.Omega - planet.OmegaDot * T) * DEG2RAD;
  const M = wrap360(L - wbar);
  const E = eccentricAnomaly(M, e);
  const xPrime = a * (Math.cos(E) - e);
  const yPrime = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cosO = Math.cos(Omega);
  const sinO = Math.sin(Omega);
  const cosI = Math.cos(I);
  const sinI = Math.sin(I);
  const cosw = Math.cos(w);
  const sinw = Math.sin(w);
  const x =
    (cosw * cosO - sinw * sinO * cosI) * xPrime + (-sinw * cosO - cosw * sinO * cosI) * yPrime;
  const y =
    (cosw * sinO + sinw * cosO * cosI) * xPrime + (-sinw * sinO + cosw * cosO * cosI) * yPrime;
  const z = sinw * sinI * xPrime + cosw * sinI * yPrime;
  const r = Math.sqrt(x * x + y * y + z * z);
  const lon = wrap360(Math.atan2(y, x) / DEG2RAD);
  return { x, y, z, r_au: r, longitude_deg: lon, a_au: a, eccentricity: e };
}

function mapApod(data) {
  if (!data || data.code || data.error) return null;
  return {
    title: data.title || null,
    explanation: data.explanation || null,
    url: data.url || null,
    hdurl: data.hdurl || null,
    media_type: data.media_type || null,
    date: data.date || null,
    copyright: data.copyright || null,
    thumbnail_url: data.thumbnail_url || null,
  };
}

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

/** @param {string|undefined} date YYYY-MM-DD optional */
export async function fetchApod(env = {}, date) {
  const key = env.NASA_API_KEY || "DEMO_KEY";
  const params = { api_key: key };
  if (date) params.date = date;
  try {
    const data = await fetchJson(APOD_URL, { params });
    return mapApod(data);
  } catch (err) {
    const msg = String(err.message || err);
    // NASA returns 400 for dates with no APOD (pre-1995-06-16, future, etc.)
    if (/HTTP 400|HTTP 404/.test(msg)) {
      return { missing: true, date: date || null, message: "No Astronomy Picture of the Day for this date." };
    }
    throw err;
  }
}

/** Recent APODs for archive strip (inclusive end date = today by default). */
export async function fetchApodRange(env = {}, days = 7) {
  const key = env.NASA_API_KEY || "DEMO_KEY";
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - Math.max(1, Math.min(days, 30)) + 1);
  const fmt = (d) => d.toISOString().slice(0, 10);
  try {
    const data = await fetchJson(APOD_URL, {
      params: { api_key: key, start_date: fmt(start), end_date: fmt(end) },
    });
    const list = Array.isArray(data) ? data : data ? [data] : [];
    return list.map(mapApod).filter(Boolean).reverse();
  } catch {
    return [];
  }
}

export async function fetchNeos(env = {}, startDate, endDate) {
  const key = env.NASA_API_KEY || "DEMO_KEY";
  const start = startDate || new Date().toISOString().slice(0, 10);
  let end = endDate;
  if (!end) {
    const d = new Date(start + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + 2);
    end = d.toISOString().slice(0, 10);
  }
  const data = await fetchJson(NEO_FEED_URL, {
    params: { api_key: key, start_date: start, end_date: end },
  });
  const near = data.near_earth_objects || {};
  const items = [];
  for (const [day, list] of Object.entries(near)) {
    for (const neo of list || []) {
      const approach = (neo.close_approach_data || [])[0] || {};
      const diam = neo.estimated_diameter?.kilometers || {};
      items.push({
        id: String(neo.id),
        name: neo.name || "NEO",
        date: day,
        hazardous: Boolean(neo.is_potentially_hazardous_asteroid),
        diameter_km_min: diam.estimated_diameter_min ?? null,
        diameter_km_max: diam.estimated_diameter_max ?? null,
        miss_distance_km: approach.miss_distance?.kilometers
          ? Number(approach.miss_distance.kilometers)
          : null,
        relative_velocity_kph: approach.relative_velocity?.kilometers_per_hour
          ? Number(approach.relative_velocity.kilometers_per_hour)
          : null,
        close_approach: approach.close_approach_date_full || approach.close_approach_date || null,
        nasa_jpl_url: neo.nasa_jpl_url || null,
      });
    }
  }
  items.sort((a, b) => (a.miss_distance_km || 1e18) - (b.miss_distance_km || 1e18));
  return {
    start_date: start,
    end_date: end,
    count: items.length,
    items: items.slice(0, 40),
    source: "NASA NeoWs",
  };
}

/** Heliocentric ecliptic positions from JPL approximate elements. */
export function computePlanets(at = new Date()) {
  const when = at instanceof Date ? at : new Date(at);
  const T = julianCenturiesFromJ2000(when);
  const planets = PLANET_ELEMENTS.map((p) => {
    const pos = helioXY(p, T);
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      x_au: pos.x,
      y_au: pos.y,
      z_au: pos.z,
      r_au: pos.r_au,
      longitude_deg: pos.longitude_deg,
      a_au: pos.a_au,
      eccentricity: pos.eccentricity,
    };
  });
  return {
    epoch: when.toISOString(),
    reference: "JPL SSD planetary mean elements (approx_pos)",
    attribution: "https://ssd.jpl.nasa.gov/planets/approx_pos.html",
    frame: "heliocentric ecliptic J2000 (approx)",
    sun: { id: "sun", name: "Sun", x_au: 0, y_au: 0, z_au: 0 },
    planets,
  };
}
