import { json, nowIso } from "./_lib/json.js";
import { getWeather } from "./_lib/services/weather.js";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const lat = url.searchParams.get("latitude");
  const lon = url.searchParams.get("longitude");
  try {
    const data = await getWeather({
      city: url.searchParams.get("city") || undefined,
      latitude: lat != null && lat !== "" ? Number(lat) : undefined,
      longitude: lon != null && lon !== "" ? Number(lon) : undefined,
      includeForecast: false,
    });
    return json(data);
  } catch (exc) {
    return json({
      ok: false,
      source: "Open-Meteo",
      updated_at: nowIso(),
      message: String(exc.message || exc),
    });
  }
}
