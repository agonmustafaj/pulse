import { cacheGet, cacheSet } from "../cache.js";
import {
  fetchIss,
  fetchLaunches,
  fetchApod,
  fetchApodRange,
  fetchNeos,
  computePlanets,
} from "../providers/space.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

  const key = date ? `space:apod:${date}` : "space:apod:today";
  const cached = await cacheGet(key);
  if (cached) return { ...cached, cached: true };

  let apod = null;
  try {
    apod = await fetchApod(env, date || undefined);
  } catch (err) {
    return {
      ok: false,
      missing: false,
      date: date || null,
      message: String(err.message || err),
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
      date: apod.date || date || null,
      message: apod.message || "No Astronomy Picture of the Day for this date.",
      apod: null,
      source: "NASA APOD",
      updated_at: new Date().toISOString(),
      cached: false,
    };
  }

  const resp = {
    ok: Boolean(apod),
    missing: !apod,
    date: apod?.date || date || null,
    message: apod ? null : "APOD unavailable. Set NASA_API_KEY for reliable access.",
    apod,
    source: apod ? "NASA APOD" : "NASA APOD",
    updated_at: new Date().toISOString(),
    cached: false,
  };
  if (apod) await cacheSet(key, resp, 600);
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
            date: apodPayload.date,
            message: apodPayload.message,
          }
        : null,
      planets: planets
        ? { epoch: planets.epoch, planets: planets.planets, sun: planets.sun, attribution: planets.attribution }
        : null,
      neos: neos?.items || [],
      extras: { apod_archive: [] },
    };
  }

  const cached = await cacheGet("space:bundle");
  if (cached) return { ...cached, cached: true };

  let iss = null;
  let launches = [];
  let apod = null;
  let apodMeta = null;
  let planets = null;
  let neos = [];
  let archive = [];
  const sources = [];

  try {
    iss = await getIss();
    sources.push(iss.source);
  } catch {
    /* optional */
  }
  try {
    launches = await fetchLaunches(12);
    sources.push("The Space Devs");
  } catch {
    launches = [];
  }
  try {
    const apodPayload = await getApod(env);
    apod = apodPayload.apod;
    apodMeta = {
      ok: apodPayload.ok,
      missing: apodPayload.missing,
      date: apodPayload.date,
      message: apodPayload.message,
    };
    if (apod) sources.push("NASA APOD");
  } catch {
    apod = null;
  }
  try {
    archive = await fetchApodRange(env, 8);
  } catch {
    archive = [];
  }
  try {
    planets = await getPlanets();
    if (planets) sources.push(planets.source);
  } catch {
    planets = null;
  }
  try {
    const neoPayload = await getNeos(env);
    neos = neoPayload.items || [];
    if (neos.length) sources.push("NASA NeoWs");
  } catch {
    neos = [];
  }

  const resp = {
    ok: Boolean(iss || launches.length || apod || planets),
    source: sources.length ? sources : ["space"],
    updated_at: new Date().toISOString(),
    cached: false,
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
  await cacheSet("space:bundle", resp, 120);
  return resp;
}
