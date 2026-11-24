import { fetchJson, fetchText } from "../http.js";

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

/** DEMO_KEY (and some degraded responses) return this site-chrome logo instead of APOD media. */
export function isPlaceholderApodUrl(url) {
  if (!url) return true;
  const u = String(url).toLowerCase();
  return (
    u.includes("nasa-logo") ||
    u.includes("/themes/nasa-child/") ||
    u.includes("nasa-logo@2x") ||
    u.includes("favicon") ||
    u.endsWith("/nasa-logo.png") ||
    u.includes("science.nasa.gov/wp-content/themes/")
  );
}

/** Real APOD images live on apods.nasa.gov / apod.nasa.gov / imgur etc. — never the NASA meatball. */
export function isUsableApodMedia(apod) {
  if (!apod || apod.placeholder) return false;
  if (apod.media_type === "video") {
    return Boolean(apod.display_url || apod.thumbnail_url || apod.url);
  }
  const src = apod.display_url || apod.hdurl || apod.url;
  return Boolean(src) && !isPlaceholderApodUrl(src);
}

export function hasNasaApiKey(env = {}) {
  const key = (env.NASA_API_KEY || "").trim();
  return Boolean(key) && key !== "DEMO_KEY";
}

function youtubeThumbnail(url) {
  if (!url) return null;
  const m = String(url).match(
    /(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i
  );
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
}

function mapApod(data) {
  if (!data || data.code || data.error) return null;
  const mediaType = data.media_type || null;
  let url = data.url || null;
  let hdurl = data.hdurl || null;
  let thumbnail = data.thumbnail_url || null;
  const title = data.title || null;

  // DEMO_KEY / degraded responses: title "NASA Science" + meatball logo URLs
  const logoPayload =
    (title === "NASA Science" && (isPlaceholderApodUrl(url) || isPlaceholderApodUrl(hdurl))) ||
    isPlaceholderApodUrl(url) ||
    isPlaceholderApodUrl(hdurl);

  // Prefer real astronomy media; never treat NASA site-chrome logos as APOD art
  if (mediaType === "image" || logoPayload) {
    if (isPlaceholderApodUrl(hdurl)) hdurl = null;
    if (isPlaceholderApodUrl(url)) url = null;
  }
  if (mediaType === "video") {
    if (!thumbnail || isPlaceholderApodUrl(thumbnail)) {
      thumbnail = youtubeThumbnail(url) || youtubeThumbnail(hdurl);
    }
  }

  const displayUrl =
    mediaType === "video" ? thumbnail || null : hdurl || url || thumbnail;

  if (logoPayload || (!displayUrl && mediaType !== "video")) {
    return {
      title,
      explanation: data.explanation || null,
      url: null,
      hdurl: null,
      display_url: null,
      media_type: mediaType,
      date: data.date || null,
      copyright: data.copyright || null,
      thumbnail_url: null,
      placeholder: true,
    };
  }

  return {
    title,
    explanation: data.explanation || null,
    url,
    hdurl,
    display_url: displayUrl,
    media_type: mediaType,
    date: data.date || null,
    copyright: data.copyright || null,
    thumbnail_url: thumbnail,
    placeholder: false,
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
  // Prefer lightweight list payload — `mode=detailed` is large and often times out on Pages.
  const data = await fetchJson(LAUNCHES_URL, {
    params: { limit, mode: "list" },
    headers: { "User-Agent": "PULSE/1.0 (galaxy; https://pulse-bw6.pages.dev)" },
    timeoutMs: 25000,
  });
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

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

function todayUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

function toApodFileDate(dateStr) {
  const d = new Date((dateStr || todayUtcDate()) + "T12:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  const yy = String(d.getUTCFullYear()).slice(2);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return {
    iso: d.toISOString().slice(0, 10),
    yymmdd: `${yy}${mm}${dd}`,
    year: d.getUTCFullYear(),
    month: MONTHS[d.getUTCMonth()],
    day: d.getUTCDate(),
  };
}

function shiftIsoDate(iso, deltaDays) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function decodeHtmlEntities(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function absolutizeUrl(src, base) {
  if (!src) return null;
  try {
    return new URL(src, base || "https://apod.nasa.gov/apod/").toString();
  } catch {
    return null;
  }
}

function scoreApodImageUrl(url) {
  if (!url || isPlaceholderApodUrl(url)) return -1;
  const u = url.toLowerCase();
  let score = 1;
  if (u.includes("cds/apod/apod/")) score += 50;
  if (u.includes("apod.nasa.gov/apod/image/")) score += 50;
  if (u.includes("assets.science.nasa.gov") && u.includes("/apod/")) score += 30;
  if (u.includes("cq5dam.web.1280")) score += 5;
  if (u.includes("dynamicimage") && u.includes("/apod/")) score += 20;
  if (u.includes("logo") || u.includes("icon") || u.includes("favicon")) score -= 100;
  return score;
}

/** Parse science.nasa.gov / classic APOD HTML for the main sky image or YouTube embed. */
export function parseApodHtml(html, { date = null, baseUrl = "https://apod.nasa.gov/apod/" } = {}) {
  const text = String(html || "");
  const titleMatch = text.match(/<title>([^<]+)<\/title>/i);
  let title = titleMatch ? decodeHtmlEntities(titleMatch[1]).replace(/\s*-\s*NASA Science\s*$/i, "").trim() : null;
  title = title?.replace(/^APOD:\s*\d{4}\s+\w+\s+\d{1,2}\s*-\s*/i, "").trim() || title;
  const h1Match = text.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    const h1 = decodeHtmlEntities(h1Match[1].replace(/<[^>]+>/g, "")).trim();
    if (h1 && h1.toLowerCase() !== "astronomy picture of the day") title = h1;
  }

  const yt =
    text.match(/<iframe[^>]+src=["']([^"']*(?:youtube\.com|youtu\.be)[^"']*)["']/i) ||
    text.match(/href=["'](https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[^"']+)["']/i);
  const youtubeUrl = yt ? decodeHtmlEntities(yt[1]) : null;

  const candidates = [];
  const og = text.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i);
  if (og) candidates.push(decodeHtmlEntities(og[1]));
  const ogSecure = text.match(/property=["']og:image:secure_url["']\s+content=["']([^"']+)["']/i);
  if (ogSecure) candidates.push(decodeHtmlEntities(ogSecure[1]));

  for (const m of text.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
    candidates.push(decodeHtmlEntities(m[1]));
  }
  // Also catch bare asset URLs in JSON/ld
  for (const m of text.matchAll(/(https:\/\/(?:assets\.science\.nasa\.gov|apod\.nasa\.gov)[^"'\\\s<>]+)/gi)) {
    candidates.push(decodeHtmlEntities(m[1].replace(/\\u002F/g, "/")));
  }

  let best = null;
  let bestScore = 0;
  for (const raw of candidates) {
    const abs = absolutizeUrl(raw.split("\\").join(""), baseUrl);
    if (!abs) continue;
    const score = scoreApodImageUrl(abs);
    if (score > bestScore) {
      bestScore = score;
      best = abs;
    }
  }

  if (youtubeUrl) {
    const thumb = youtubeThumbnail(youtubeUrl) || best;
    return {
      title,
      explanation: null,
      url: youtubeUrl,
      hdurl: null,
      display_url: thumb,
      media_type: "video",
      date,
      copyright: null,
      thumbnail_url: thumb,
      placeholder: false,
      source: "apod.nasa.gov html",
    };
  }

  if (!best || bestScore < 1) {
    return null;
  }

  // Prefer a cleaner non-rendition path when available
  let display = best;
  const clean = best.replace(/\/jcr:content\/renditions\/[^/?#]+/i, "");
  if (clean !== best && scoreApodImageUrl(clean) > 0) display = clean;

  return {
    title,
    explanation: null,
    url: display,
    hdurl: display,
    display_url: display,
    media_type: "image",
    date,
    copyright: null,
    thumbnail_url: null,
    placeholder: false,
    source: "apod.nasa.gov html",
  };
}

function findDatedApodArticleHref(html, dateInfo) {
  if (!dateInfo) return null;
  const needle = `apod-${dateInfo.year}-${dateInfo.month}-${dateInfo.day}`;
  const re = new RegExp(`href=["']([^"']*${needle}[^"']*)["']`, "i");
  const m = String(html || "").match(re);
  if (!m) return null;
  return absolutizeUrl(decodeHtmlEntities(m[1]), "https://science.nasa.gov/");
}

/** Scrape classic apYYMMDD.html (redirects to science.nasa.gov article) for real media. */
export async function scrapeApodHtml(date) {
  const info = toApodFileDate(date || todayUtcDate());
  if (!info) return null;
  const today = todayUtcDate();
  const startUrl =
    info.iso === today
      ? "https://apod.nasa.gov/apod/astropix.html"
      : `https://apod.nasa.gov/apod/ap${info.yymmdd}.html`;

  try {
    let { text, finalUrl } = await fetchText(startUrl, { timeoutMs: 20000 });
    // Classic dated URL sometimes lands on the APOD index — resolve the dated article link.
    if (!/\/image-article\/apod-/i.test(finalUrl || "")) {
      const href = findDatedApodArticleHref(text, info);
      if (href) {
        ({ text, finalUrl } = await fetchText(href, { timeoutMs: 20000 }));
      } else if (info.iso === today) {
        // Index page for today — also try science.nasa.gov/apod/
        const index = await fetchText("https://science.nasa.gov/apod/", { timeoutMs: 20000 });
        const href2 = findDatedApodArticleHref(index.text, info);
        if (href2) ({ text, finalUrl } = await fetchText(href2, { timeoutMs: 20000 }));
        else text = index.text;
      }
    }
    const parsed = parseApodHtml(text, { date: info.iso, baseUrl: finalUrl });
    if (parsed && isUsableApodMedia(parsed)) return parsed;
    return null;
  } catch {
    return null;
  }
}

async function fetchApodFromApi(env, date) {
  if (!hasNasaApiKey(env)) return null;
  const key = env.NASA_API_KEY.trim();
  const params = { api_key: key, thumbs: "true" };
  if (date) params.date = date;
  const data = await fetchJson(APOD_URL, { params });
  return mapApod(data);
}

function mergeApodMeta(primary, fallback) {
  if (!fallback) return primary;
  if (!primary) return fallback;
  return {
    ...fallback,
    title:
      primary.title && primary.title !== "NASA Science" ? primary.title : fallback.title || primary.title,
    explanation: primary.explanation || fallback.explanation,
    copyright: primary.copyright || fallback.copyright,
    date: primary.date || fallback.date,
    source: fallback.source || primary.source,
  };
}

/**
 * Fetch APOD for a date. Uses api.nasa.gov when healthy; falls back to apod.nasa.gov HTML
 * scrape (and adjacent dates) when the API returns the broken NASA-logo payload.
 * @param {string|undefined} date YYYY-MM-DD optional
 */
export async function fetchApod(env = {}, date) {
  const target = date || todayUtcDate();
  let apiMapped = null;
  let apiError = null;

  if (hasNasaApiKey(env)) {
    try {
      apiMapped = await fetchApodFromApi(env, date || undefined);
    } catch (err) {
      apiError = err;
      const msg = String(err.message || err);
      if (/HTTP 400|HTTP 404/.test(msg)) {
        // Still try HTML — some dates exist on the site even when API 404s
      } else if (/HTTP 403|HTTP 429/.test(msg)) {
        // continue to HTML fallback
      } else {
        // network blip — still try HTML
      }
    }
  }

  if (apiMapped && isUsableApodMedia(apiMapped)) {
    return apiMapped;
  }

  // Broken API payload (logo / "NASA Science") or no key → scrape HTML for this date
  let scraped = await scrapeApodHtml(target);
  if (scraped && isUsableApodMedia(scraped)) {
    return mergeApodMeta(apiMapped, scraped);
  }

  // Adjacent dates: HTML first, then API
  for (const delta of [-1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -6, 6, -7, 7]) {
    const adj = shiftIsoDate(target, delta);
    if (adj < "1995-06-16" || adj > todayUtcDate()) continue;
    scraped = await scrapeApodHtml(adj);
    if (scraped && isUsableApodMedia(scraped)) {
      return {
        ...scraped,
        explanation:
          (apiMapped && apiMapped.explanation) ||
          scraped.explanation ||
          `Showing nearest available APOD (${adj}); NASA API media for ${target} was unavailable.`,
        fallback_from: target,
      };
    }
    if (hasNasaApiKey(env)) {
      try {
        const adjApi = await fetchApodFromApi(env, adj);
        if (adjApi && isUsableApodMedia(adjApi)) {
          return {
            ...adjApi,
            explanation:
              adjApi.explanation ||
              `Showing nearest available APOD (${adj}); NASA API media for ${target} was unavailable.`,
            fallback_from: target,
          };
        }
      } catch {
        /* try next */
      }
    }
  }

  if (apiError && /HTTP 403|HTTP 429/.test(String(apiError.message || apiError))) {
    return {
      needs_api_key: true,
      missing: false,
      date: target,
      message: "NASA APOD rate-limited or unauthorized. Check NASA_API_KEY on this Pages environment.",
    };
  }

  if (!hasNasaApiKey(env) && !scraped) {
    return {
      needs_api_key: true,
      missing: false,
      date: target,
      message:
        "Could not load APOD from apod.nasa.gov. Add NASA_API_KEY in Cloudflare Pages for API access, or retry shortly.",
    };
  }

  return {
    missing: true,
    date: target,
    message: "No usable Astronomy Picture of the Day media for this date (API and HTML fallback failed).",
  };
}

/** Recent APODs for archive strip — HTML scrape in parallel (avoids broken API logo URLs). */
export async function fetchApodRange(env = {}, days = 7) {
  const end = todayUtcDate();
  const count = Math.max(1, Math.min(days, 8));
  const dates = Array.from({ length: count }, (_, i) => shiftIsoDate(end, -i));
  const results = await Promise.allSettled(dates.map((d) => scrapeApodHtml(d)));
  const out = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value && isUsableApodMedia(r.value)) {
      out.push({ ...r.value, date: r.value.date || dates[i] });
    }
  });
  return out;
}

export async function fetchNeos(env = {}, startDate, endDate) {
  if (!hasNasaApiKey(env)) {
    return {
      start_date: startDate || null,
      end_date: endDate || null,
      count: 0,
      items: [],
      source: "NASA NeoWs",
      needs_api_key: true,
    };
  }
  const key = env.NASA_API_KEY.trim();
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
