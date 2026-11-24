#!/usr/bin/env node
/**
 * Smoke-test Pages Functions service layer against live public APIs.
 * Run: node scripts/smoke-functions.mjs
 */
import { pathToFileURL } from "node:url";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lib = (p) => pathToFileURL(join(root, "functions/api/_lib", p)).href;

const results = [];

async function check(name, fn) {
  const t0 = Date.now();
  try {
    const data = await fn();
    const ok =
      data &&
      (data.ok === true ||
        data.ok === false ||
        data.latitude != null ||
        Array.isArray(data.points) ||
        (data.items && data.items.length >= 0));
    results.push({ name, ok: Boolean(ok), ms: Date.now() - t0, detail: summarize(data) });
    console.log(`${ok ? "OK" : "FAIL"}  ${name} (${Date.now() - t0}ms) ${summarize(data)}`);
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - t0, detail: String(e.message || e) });
    console.log(`FAIL ${name} (${Date.now() - t0}ms) ${e.message || e}`);
  }
}

function summarize(data) {
  if (!data || typeof data !== "object") return String(data);
  if (data.items) return `items=${data.items.length} total=${data.total ?? data.items.length}`;
  if (data.current) return `city=${data.current.location} temp=${data.current.temperature_c}`;
  if (data.iss) return `iss=${data.iss.latitude?.toFixed?.(2)},${data.iss.longitude?.toFixed?.(2)} launches=${data.launches?.length}`;
  if (data.apod) return `apod=${data.apod.date || data.date} title=${(data.apod.title || "").slice(0, 40)}`;
  if (data.missing) return `missing date=${data.date} msg=${(data.message || "").slice(0, 40)}`;
  if (data.planets) return `planets=${data.planets.length} epoch=${data.epoch}`;
  if (data.latitude != null) return `lat=${data.latitude} lon=${data.longitude}`;
  if (data.by_category) return `cats=${data.by_category.length}`;
  if (data.status) return `status=${data.status}`;
  if (data.points) return `points=${data.points.length}`;
  return JSON.stringify(data).slice(0, 80);
}

const { getEvents } = await import(lib("services/events.js"));
const { getNews } = await import(lib("services/news.js"));
const { getWeather, searchCities } = await import(lib("services/weather.js"));
const { getMarkets, getHistory } = await import(lib("services/markets.js"));
const { getSpace, getIss, getApod, getPlanets, getNeos } = await import(lib("services/space.js"));
const { getAnalytics } = await import(lib("services/analytics.js"));
const { search } = await import(lib("services/search.js"));

await check("events", () => getEvents({ limit: 20 }));
await check("news", () => getNews({}, { limit: 10 }));
await check("weather", () => getWeather({ city: "London", includeForecast: false }));
await check("weather/forecast", () => getWeather({ city: "London", includeForecast: true }));
await check("weather/cities", async () => ({ ok: true, items: await searchCities("Tok") }));
await check("markets", () => getMarkets());
await check("markets/history", () => getHistory("AAPL", "1m"));
await check("space/iss", () => getIss());
await check("space", () => getSpace({}));
await check("space/apod-date", () => getApod({}, "2015-07-14"));
await check("space/apod-invalid", async () => {
  const r = await getApod({}, "1900-01-01");
  return { ok: r.missing === true, missing: r.missing, message: r.message };
});
await check("space/planets", () => getPlanets());
await check("space/neos", () => getNeos({}));
await check("analytics", () => getAnalytics({}));
await check("search", () => search({}, "quake"));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
