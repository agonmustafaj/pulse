import { fetchJson } from "../http.js";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const AQ_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

const WMO_CODES = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Slight snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Rain showers",
  82: "Violent rain showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with heavy hail",
};

export async function geocodeCity(name, count = 5) {
  const data = await fetchJson(GEOCODE_URL, {
    params: { name, count, language: "en", format: "json" },
  });
  return (data.results || []).map((r) => ({
    id: r.id,
    name: r.name,
    latitude: r.latitude,
    longitude: r.longitude,
    country: r.country,
    admin1: r.admin1,
    timezone: r.timezone,
    population: r.population,
  }));
}

export async function fetchWeather(lat, lon, locationName = "Selected location") {
  const params = {
    latitude: lat,
    longitude: lon,
    current: [
      "temperature_2m",
      "apparent_temperature",
      "relative_humidity_2m",
      "weather_code",
      "wind_speed_10m",
      "wind_direction_10m",
      "visibility",
      "surface_pressure",
    ].join(","),
    hourly: "temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum",
    timezone: "auto",
    forecast_days: 7,
  };
  const data = await fetchJson(FORECAST_URL, { params });
  const current = data.current || {};
  const code = current.weather_code;
  let aqi = null;
  try {
    const aq = await fetchJson(AQ_URL, {
      params: { latitude: lat, longitude: lon, current: "us_aqi,pm2_5" },
    });
    aqi = aq.current?.us_aqi ?? null;
  } catch {
    aqi = null;
  }

  const weather = {
    location: locationName,
    latitude: lat,
    longitude: lon,
    temperature_c: current.temperature_2m ?? null,
    feels_like_c: current.apparent_temperature ?? null,
    humidity: current.relative_humidity_2m ?? null,
    wind_speed_kmh: current.wind_speed_10m ?? null,
    wind_direction: current.wind_direction_10m ?? null,
    visibility_m: current.visibility ?? null,
    pressure_hpa: current.surface_pressure ?? null,
    condition: WMO_CODES[code] || (code != null ? `Code ${code}` : null),
    weather_code: code ?? null,
    timezone: data.timezone ?? null,
    local_time: current.time ?? null,
    aqi,
    updated: new Date().toISOString(),
  };

  const hourlyRaw = data.hourly || {};
  const times = hourlyRaw.time || [];
  const hourly = times.slice(0, 48).map((t, i) => ({
    time: t,
    temperature_c: (hourlyRaw.temperature_2m || [])[i] ?? null,
    weather_code: (hourlyRaw.weather_code || [])[i] ?? null,
    wind_speed_kmh: (hourlyRaw.wind_speed_10m || [])[i] ?? null,
    humidity: (hourlyRaw.relative_humidity_2m || [])[i] ?? null,
  }));

  const dailyRaw = data.daily || {};
  const dtimes = dailyRaw.time || [];
  const daily = dtimes.map((t, i) => {
    const wc = (dailyRaw.weather_code || [])[i] ?? null;
    return {
      date: t,
      temp_max_c: (dailyRaw.temperature_2m_max || [])[i] ?? null,
      temp_min_c: (dailyRaw.temperature_2m_min || [])[i] ?? null,
      precipitation_mm: (dailyRaw.precipitation_sum || [])[i] ?? null,
      weather_code: wc,
      condition: WMO_CODES[wc] || null,
    };
  });

  return { current: weather, forecast: { hourly, daily } };
}
