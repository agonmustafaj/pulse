from datetime import datetime, timezone

from fastapi import APIRouter, Query

from app.schemas.weather import WeatherResponse
from app.services import weather_service

router = APIRouter(tags=["weather"])


@router.get("/weather", response_model=WeatherResponse)
async def weather(
    city: str | None = None,
    latitude: float | None = Query(None),
    longitude: float | None = Query(None),
):
    try:
        return await weather_service.get_weather(city=city, latitude=latitude, longitude=longitude, include_forecast=False)
    except Exception as exc:  # noqa: BLE001
        return WeatherResponse(ok=False, source="Open-Meteo", updated_at=datetime.now(timezone.utc), message=str(exc))


@router.get("/weather/forecast", response_model=WeatherResponse)
async def weather_forecast(
    city: str | None = None,
    latitude: float | None = Query(None),
    longitude: float | None = Query(None),
):
    try:
        return await weather_service.get_weather(city=city, latitude=latitude, longitude=longitude, include_forecast=True)
    except Exception as exc:  # noqa: BLE001
        return WeatherResponse(ok=False, source="Open-Meteo", updated_at=datetime.now(timezone.utc), message=str(exc))


@router.get("/weather/cities")
async def weather_cities(q: str = Query(..., min_length=2)):
    try:
        results = await weather_service.search_cities(q)
        return {"ok": True, "items": results, "source": "Open-Meteo Geocoding", "updated_at": datetime.now(timezone.utc)}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "items": [], "error": str(exc), "updated_at": datetime.now(timezone.utc)}
