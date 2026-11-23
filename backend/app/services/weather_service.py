from __future__ import annotations

from datetime import datetime, timezone

from app.cache import cache
from app.providers import open_meteo
from app.schemas.weather import WeatherResponse


async def get_weather(
    city: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
    include_forecast: bool = True,
) -> WeatherResponse:
    location_name = city or "Selected location"
    lat, lon = latitude, longitude

    if city and (lat is None or lon is None):
        results = await open_meteo.geocode_city(city, count=1)
        if not results:
            return WeatherResponse(
                ok=False,
                source="Open-Meteo Geocoding",
                updated_at=datetime.now(timezone.utc),
                message=f"No results for city '{city}'",
            )
        hit = results[0]
        lat, lon = hit["latitude"], hit["longitude"]
        location_name = f"{hit['name']}, {hit.get('country') or ''}".strip(", ")

    if lat is None or lon is None:
        # Default: New York overview
        lat, lon = 40.7128, -74.006
        location_name = "New York, United States"

    cache_key = f"weather:{round(lat, 3)}:{round(lon, 3)}:{include_forecast}"
    cached = await cache.get(cache_key)
    if cached:
        return WeatherResponse.model_validate({**cached, "cached": True})

    current, forecast = await open_meteo.fetch_weather(lat, lon, location_name)
    resp = WeatherResponse(
        ok=True,
        source="Open-Meteo",
        updated_at=datetime.now(timezone.utc),
        cached=False,
        current=current,
        forecast=forecast if include_forecast else None,
    )
    await cache.set(cache_key, resp.model_dump(mode="json"), 600)
    return resp


async def search_cities(q: str) -> list[dict]:
    if not q or len(q) < 2:
        return []
    cache_key = f"geocode:{q.lower()}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached
    results = await open_meteo.geocode_city(q, count=8)
    await cache.set(cache_key, results, 3600)
    return results
