from __future__ import annotations

from datetime import datetime, timezone

from app.schemas.weather import WeatherCurrent, WeatherForecast
from app.utils.http import fetch_json

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
AQ_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"

WMO_CODES = {
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
}


async def geocode_city(name: str, count: int = 5) -> list[dict]:
    data = await fetch_json(GEOCODE_URL, params={"name": name, "count": count, "language": "en", "format": "json"})
    results = []
    for r in data.get("results") or []:
        results.append(
            {
                "id": r.get("id"),
                "name": r.get("name"),
                "latitude": r.get("latitude"),
                "longitude": r.get("longitude"),
                "country": r.get("country"),
                "admin1": r.get("admin1"),
                "timezone": r.get("timezone"),
                "population": r.get("population"),
            }
        )
    return results


async def fetch_weather(lat: float, lon: float, location_name: str = "Selected location") -> tuple[WeatherCurrent, WeatherForecast]:
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": ",".join(
            [
                "temperature_2m",
                "apparent_temperature",
                "relative_humidity_2m",
                "weather_code",
                "wind_speed_10m",
                "wind_direction_10m",
                "visibility",
                "surface_pressure",
            ]
        ),
        "hourly": "temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum",
        "timezone": "auto",
        "forecast_days": 7,
    }
    data = await fetch_json(FORECAST_URL, params=params)
    current = data.get("current") or {}
    code = current.get("weather_code")
    aqi = None
    try:
        aq = await fetch_json(AQ_URL, params={"latitude": lat, "longitude": lon, "current": "us_aqi,pm2_5"})
        aqi = (aq.get("current") or {}).get("us_aqi")
    except Exception:  # noqa: BLE001
        aqi = None

    weather = WeatherCurrent(
        location=location_name,
        latitude=lat,
        longitude=lon,
        temperature_c=current.get("temperature_2m"),
        feels_like_c=current.get("apparent_temperature"),
        humidity=current.get("relative_humidity_2m"),
        wind_speed_kmh=current.get("wind_speed_10m"),
        wind_direction=current.get("wind_direction_10m"),
        visibility_m=current.get("visibility"),
        pressure_hpa=current.get("surface_pressure"),
        condition=WMO_CODES.get(code, f"Code {code}" if code is not None else None),
        weather_code=code,
        timezone=data.get("timezone"),
        local_time=current.get("time"),
        aqi=aqi,
        updated=datetime.now(timezone.utc),
    )

    hourly_raw = data.get("hourly") or {}
    times = hourly_raw.get("time") or []
    hourly = []
    for i, t in enumerate(times[:48]):
        hourly.append(
            {
                "time": t,
                "temperature_c": (hourly_raw.get("temperature_2m") or [None])[i],
                "weather_code": (hourly_raw.get("weather_code") or [None])[i],
                "wind_speed_kmh": (hourly_raw.get("wind_speed_10m") or [None])[i],
                "humidity": (hourly_raw.get("relative_humidity_2m") or [None])[i],
            }
        )

    daily_raw = data.get("daily") or {}
    dtimes = daily_raw.get("time") or []
    daily = []
    for i, t in enumerate(dtimes):
        daily.append(
            {
                "date": t,
                "temp_max_c": (daily_raw.get("temperature_2m_max") or [None])[i],
                "temp_min_c": (daily_raw.get("temperature_2m_min") or [None])[i],
                "precipitation_mm": (daily_raw.get("precipitation_sum") or [None])[i],
                "weather_code": (daily_raw.get("weather_code") or [None])[i],
                "condition": WMO_CODES.get((daily_raw.get("weather_code") or [None])[i]),
            }
        )

    return weather, WeatherForecast(hourly=hourly, daily=daily)
