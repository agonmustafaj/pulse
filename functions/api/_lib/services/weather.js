import { cacheGet, cacheSet } from "../cache.js";
import { geocodeCity, fetchWeather } from "../providers/open_meteo.js";

export async function getWeather({ city, latitude, longitude, includeForecast = true } = {}) {
  let locationName = city || "Selected location";
  let lat = latitude;
  let lon = longitude;

  if (city && (lat == null || lon == null)) {
    const results = await geocodeCity(city, 1);
    if (!results.length) {
      return {
        ok: false,
        source: "Open-Meteo Geocoding",
        updated_at: new Date().toISOString(),
        message: `No results for city '${city}'`,
      };
    }
    const hit = results[0];
    lat = hit.latitude;
    lon = hit.longitude;
    locationName = `${hit.name}, ${hit.country || ""}`.replace(/,\s*$/, "");
  }

  if (lat == null || lon == null) {
    lat = 40.7128;
    lon = -74.006;
    locationName = "New York, United States";
  }

  const cacheKey = `weather:${Number(lat).toFixed(3)}:${Number(lon).toFixed(3)}:${includeForecast}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return { ...cached, cached: true };

  const { current, forecast } = await fetchWeather(lat, lon, locationName);
  const resp = {
    ok: true,
    source: "Open-Meteo",
    updated_at: new Date().toISOString(),
    cached: false,
    current,
    forecast: includeForecast ? forecast : null,
  };
  await cacheSet(cacheKey, resp, 600);
  return resp;
}

export async function searchCities(q) {
  if (!q || q.length < 2) return [];
  const cacheKey = `geocode:${q.toLowerCase()}`;
  const cached = await cacheGet(cacheKey);
  if (cached != null) return cached;
  const results = await geocodeCity(q, 8);
  await cacheSet(cacheKey, results, 3600);
  return results;
}
