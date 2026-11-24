import { cacheGet, cacheSet } from "../cache.js";
import {
  fetchIss,
  fetchLaunches,
  fetchApod,
  fetchApodRange,
  fetchNeos,
  computePlanets,
  hasNasaApiKey,
  isPlaceholderApodUrl,
  isUsableApodMedia,
} from "../providers/space.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Bump when APOD response shape / fallback logic changes — invalidates Cache API entries. */
const APOD_CACHE_VER = "v3";
const BUNDLE_CACHE_KEY = "space:bundle:v3";

function apodCacheKey(date) {
  return date ? `space:apod:${APOD_CACHE_VER}:${date}` : `space:apod:${APOD_CACHE_VER}:today`;
}

/** True when a cached/API apod payload still has the broken NASA meatball URLs. */
export function apodPayloadHasLogo(apod) {
  if (!apod) return false;
  if (apod.title === "NASA Science") return true;
  // Only inspect present URL fields — null hdurl is normal for video APODs
  const fields = [apod.url, apod.hdurl, apod.display_url, apod.thumbnail_url].filter(
    (u) => u != null && String(u).trim() !== ""
  );
  if (!fields.length) return true;
  // Logo if every present field is a meatball / theme asset
  return fields.every((u) => isPlaceholderApodUrl(u));
}

/** Ensure url/hdurl/display_url are real sky media — never leave logo URLs in the response. */
export function sanitizeApodFields(apod) {
  if (!apod || typeof apod !== "object") return null;
  if (!isUsableApodMedia(apod) || apodPayloadHasLogo(apod)) return null;
  if (apod.media_type === "video") {
    const display = apod.display_url || apod.thumbnail_url || null;
    if (display && isPlaceholderApodUrl(display)) return null;
    return {
      ...apod,
      url: apod.url || display,
      hdurl: apod.hdurl || null,
      display_url: display,
      thumbnail_url: apod.thumbnail_url || display,
      placeholder: false,
    };
  }
  const display = apod.display_url || apod.hdurl || apod.url;
  if (!display || isPlaceholderApodUrl(display)) return null;
  return {
    ...apod,
    url: display,
    hdurl: display,
    display_url: display,
    placeholder: false,
  };
}

export function isValidApodDate(date) {
  if (!date || !DATE_RE.test(date)) return false;
  const d = new Date(date + "T12:00:00Z");
  if (Number.isNaN(d.getTime())) return false;
  // APOD starts 1995-06-16; reject future dates
  const min = new Date("1995-06-16T12:00:00Z");
  const max = new Date();
  max.setUTCHours(23, 59, 59, 999);
  return d >= min && d <= max;
}

export async function getIss() {
  const cached = await cacheGet("space:iss");
  if (cached) return cached;
  const iss = await fetchIss();
  await cacheSet("space:iss", iss, 20);
  return iss;
}

export async function getApod(env = {}, date) {
  if (date && !isValidApodDate(date)) {
    return {
      ok: false,
      missing: true,
      date,
      message: "Date must be YYYY-MM-DD between 1995-06-16 and today.",
      apod: null,
      source: "NASA APOD",
      updated_at: new Date().toISOString(),
      cached: false,
    };
  }

  const key = apodCacheKey(date);
  const cached = await cacheGet(key);
  // Never serve stale Cache API entries that still contain the NASA meatball logo
  if (cached?.apod && !apodPayloadHasLogo(cached.apod)) {
    const clean = sanitizeApodFields(cached.apod);
    if (clean) return { ...cached, apod: clean, cached: true };
  }

  let apod = null;
  try {
    apod = await fetchApod(env, date || undefined);
  } catch (err) {
    return {
      ok: false,
      missing: false,
      needs_api_key: !hasNasaApiKey(env),
      has_nasa_key: hasNasaApiKey(env),
      date: date || null,
      message: String(err.message || err),
      apod: null,
      source: "NASA APOD",
      updated_at: new Date().toISOString(),
      cached: false,
    };
  }

  if (apod?.needs_api_key) {
    return {
      ok: false,
      missing: false,
      needs_api_key: true,
      has_nasa_key: false,
      date: apod.date || date || null,
      message:
        apod.message ||
        "Add NASA_API_KEY in Cloudflare Pages (Production + Preview) to load Astronomy Picture of the Day.",
      apod: null,
      source: "NASA APOD",
      updated_at: new Date().toISOString(),
      cached: false,
    };
  }

  if (apod?.missing) {
    return {
      ok: false,
      missing: true,
      needs_api_key: false,
      has_nasa_key: hasNasaApiKey(env),
      date: apod.date || date || null,
      message: apod.message || "No Astronomy Picture of the Day for this date.",
      apod: null,
      source: "NASA APOD",
      updated_at: new Date().toISOString(),
      cached: false,
    };
  }

  const clean = sanitizeApodFields(apod);
  if (!clean) {
    return {
      ok: false,
      missing: true,
      needs_api_key: false,
      has_nasa_key: hasNasaApiKey(env),
      date: apod?.date || date || null,
      message:
        "NASA APOD API returned logo placeholder media and HTML fallback did not yield a usable image.",
      apod: null,
      source: "NASA APOD",
      updated_at: new Date().toISOString(),
      cached: false,
    };
  }

  const resp = {
    ok: true,
    missing: false,
    needs_api_key: false,
    has_nasa_key: hasNasaApiKey(env),
    date: clean.date || date || null,
    message: null,
    apod: clean,
    source: clean.source || "NASA APOD",
    updated_at: new Date().toISOString(),
    cached: false,
  };
  // Short TTL — API has been serving broken payloads; don't pin logos for long
  await cacheSet(key, resp, 180);
  return resp;
}

export async function getNeos(env = {}, startDate, endDate) {
  const cacheKey = `space:neos:${startDate || "today"}:${endDate || "default"}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return { ...cached, cached: true };
  const neo = await fetchNeos(env, startDate, endDate);
  const resp = {
    ok: true,
    ...neo,
    updated_at: new Date().toISOString(),
    cached: false,
  };
  await cacheSet(cacheKey, resp, 300);
  return resp;
}

export async function getPlanets() {
  const cached = await cacheGet("space:planets");
  if (cached) return { ...cached, cached: true };
  const data = computePlanets(new Date());
  const resp = {
    ok: true,
    source: data.reference,
    attribution: data.attribution,
    updated_at: new Date().toISOString(),
    cached: false,
    ...data,
  };
  await cacheSet("space:planets", resp, 300);
  return resp;
}

export async function getSpace(env = {}, { date } = {}) {
  // When a specific APOD date is requested, skip the shared bundle cache
  // so date=YYYY-MM-DD always resolves fresh (with per-date APOD cache).
  if (date) {
    const [issResult, launchesResult, apodResult, planetsResult, neosResult] = await Promise.allSettled([
      getIss(),
      fetchLaunches(12),
      getApod(env, date),
      getPlanets(),
      getNeos(env),
    ]);

    const iss = issResult.status === "fulfilled" ? issResult.value : null;
    const launches = launchesResult.status === "fulfilled" ? launchesResult.value : [];
    const apodPayload = apodResult.status === "fulfilled" ? apodResult.value : null;
    const planets = planetsResult.status === "fulfilled" ? planetsResult.value : null;
    const neos = neosResult.status === "fulfilled" ? neosResult.value : null;
    const sources = [];
    if (iss) sources.push(iss.source);
    if (launches.length) sources.push("The Space Devs");
    if (apodPayload?.apod) sources.push("NASA APOD");
    if (planets) sources.push(planets.source);
    if (neos?.ok) sources.push("NASA NeoWs");

    return {
      ok: Boolean(iss || launches.length || apodPayload?.apod || planets),
      source: sources.length ? sources : ["space"],
      updated_at: new Date().toISOString(),
      cached: false,
      iss,
      launches,
      apod: apodPayload?.apod || null,
      apod_meta: apodPayload
        ? {
            ok: apodPayload.ok,
            missing: apodPayload.missing,
            needs_api_key: apodPayload.needs_api_key,
            has_nasa_key: apodPayload.has_nasa_key,
            date: apodPayload.date,
            message: apodPayload.message,
          }
        : null,
      has_nasa_key: hasNasaApiKey(env),
      planets: planets
        ? { epoch: planets.epoch, planets: planets.planets, sun: planets.sun, attribution: planets.attribution }
        : null,
      neos: neos?.items || [],
      extras: { apod_archive: [] },
    };
  }

  const cached = await cacheGet(BUNDLE_CACHE_KEY);
  if (cached && !apodPayloadHasLogo(cached.apod)) {
    const clean = sanitizeApodFields(cached.apod);
    if (clean || !cached.apod) {
      return { ...cached, apod: clean || cached.apod || null, cached: true };
    }
  }

  const [issResult, launchesResult, apodResult, archiveResult, planetsResult, neosResult] =
    await Promise.allSettled([
      getIss(),
      fetchLaunches(12),
      getApod(env),
      fetchApodRange(env, 8),
      getPlanets(),
      getNeos(env),
    ]);

  const sources = [];
  const iss = issResult.status === "fulfilled" ? issResult.value : null;
  if (iss) sources.push(iss.source);

  const launches = launchesResult.status === "fulfilled" ? launchesResult.value : [];
  if (launches.length) sources.push("The Space Devs");

  const apodPayload = apodResult.status === "fulfilled" ? apodResult.value : null;
  const apod = sanitizeApodFields(apodPayload?.apod) || null;
  const apodMeta = apodPayload
    ? {
        ok: apodPayload.ok,
        missing: apodPayload.missing,
        needs_api_key: apodPayload.needs_api_key,
        has_nasa_key: apodPayload.has_nasa_key,
        date: apodPayload.date,
        message: apodPayload.message,
      }
    : null;
  if (apod) sources.push(apod.source || "NASA APOD");

  const archive = archiveResult.status === "fulfilled" ? archiveResult.value : [];
  const planets = planetsResult.status === "fulfilled" ? planetsResult.value : null;
  if (planets) sources.push(planets.source);

  const neoPayload = neosResult.status === "fulfilled" ? neosResult.value : null;
  const neos = neoPayload?.items || [];
  if (neos.length) sources.push("NASA NeoWs");

  const resp = {
    ok: Boolean(iss || launches.length || apod || planets),
    source: sources.length ? sources : ["space"],
    updated_at: new Date().toISOString(),
    cached: false,
    has_nasa_key: hasNasaApiKey(env),
    iss,
    launches,
    apod,
    apod_meta: apodMeta,
    planets: planets
      ? { epoch: planets.epoch, planets: planets.planets, sun: planets.sun, attribution: planets.attribution }
      : null,
    neos,
    extras: { apod_archive: archive },
  };
  await cacheSet(BUNDLE_CACHE_KEY, resp, 90);
  return resp;
}
