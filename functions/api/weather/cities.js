import { json, nowIso } from "../_lib/json.js";
import { searchCities } from "../_lib/services/weather.js";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const q = url.searchParams.get("q") || "";
  if (q.length < 2) {
    return json({ ok: false, items: [], error: "q must be at least 2 characters", updated_at: nowIso() }, 400);
  }
  try {
    const results = await searchCities(q);
    return json({
      ok: true,
      items: results,
      source: "Open-Meteo Geocoding",
      updated_at: nowIso(),
    });
  } catch (exc) {
    return json({ ok: false, items: [], error: String(exc.message || exc), updated_at: nowIso() });
  }
}
