import { cacheGet, cacheSet } from "../cache.js";
import { fetchIss, fetchLaunches, fetchApod } from "../providers/space.js";

export async function getIss() {
  const cached = await cacheGet("space:iss");
  if (cached) return cached;
  const iss = await fetchIss();
  await cacheSet("space:iss", iss, 20);
  return iss;
}

export async function getSpace(env = {}) {
  const cached = await cacheGet("space:bundle");
  if (cached) return { ...cached, cached: true };

  let iss = null;
  let launches = [];
  let apod = null;
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
    apod = await fetchApod(env);
    if (apod) sources.push("NASA APOD");
  } catch {
    apod = null;
  }

  const resp = {
    ok: Boolean(iss || launches.length || apod),
    source: sources.length ? sources : ["space"],
    updated_at: new Date().toISOString(),
    cached: false,
    iss,
    launches,
    apod,
    extras: {},
  };
  await cacheSet("space:bundle", resp, 120);
  return resp;
}
