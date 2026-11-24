from __future__ import annotations

from datetime import datetime, timezone

from app.config import get_settings
from app.schemas.space import APOD, ISSPosition, Launch
from app.utils.http import fetch_json

ISS_URL = "https://api.wheretheiss.at/v1/satellites/25544"
ISS_FALLBACK = "http://api.open-notify.org/iss-now.json"
LAUNCHES_URL = "https://ll.thespacedevs.com/2.2.0/launch/upcoming/"
APOD_URL = "https://api.nasa.gov/planetary/apod"


async def fetch_iss() -> ISSPosition:
    try:
        data = await fetch_json(ISS_URL)
        ts = data.get("timestamp")
        return ISSPosition(
            latitude=float(data["latitude"]),
            longitude=float(data["longitude"]),
            altitude_km=float(data.get("altitude")) if data.get("altitude") is not None else None,
            velocity_kmh=float(data.get("velocity")) if data.get("velocity") is not None else None,
            visibility=data.get("visibility"),
            timestamp=datetime.fromtimestamp(ts, tz=timezone.utc) if ts else datetime.now(timezone.utc),
            source="wheretheiss.at",
        )
    except Exception:  # noqa: BLE001
        data = await fetch_json(ISS_FALLBACK)
        pos = data.get("iss_position") or {}
        ts = data.get("timestamp")
        return ISSPosition(
            latitude=float(pos["latitude"]),
            longitude=float(pos["longitude"]),
            altitude_km=None,
            velocity_kmh=None,
            visibility=None,
            timestamp=datetime.fromtimestamp(ts, tz=timezone.utc) if ts else datetime.now(timezone.utc),
            source="Open Notify",
        )


async def fetch_launches(limit: int = 12) -> list[Launch]:
    data = await fetch_json(LAUNCHES_URL, params={"limit": limit, "mode": "detailed"})
    launches: list[Launch] = []
    for item in data.get("results") or []:
        pad = item.get("pad") or {}
        loc = pad.get("location") or {}
        net = None
        if item.get("net"):
            try:
                net = datetime.fromisoformat(item["net"].replace("Z", "+00:00"))
            except ValueError:
                net = None
        status = (item.get("status") or {}).get("name")
        image = None
        if item.get("image"):
            image = item["image"] if isinstance(item["image"], str) else (item["image"] or {}).get("image_url")
        launches.append(
            Launch(
                id=str(item.get("id")),
                name=item.get("name") or "Launch",
                status=status,
                net=net,
                pad=pad.get("name"),
                location=loc.get("name"),
                latitude=pad.get("latitude"),
                longitude=pad.get("longitude"),
                provider=(item.get("launch_service_provider") or {}).get("name"),
                url=item.get("url"),
                image_url=image,
            )
        )
    return launches


async def fetch_apod(date: str | None = None) -> APOD | None:
    settings = get_settings()
    key = settings.nasa_api_key or "DEMO_KEY"
    params: dict[str, str] = {"api_key": key}
    if date:
        params["date"] = date
    try:
        data = await fetch_json(APOD_URL, params=params)
        if data.get("code") or data.get("error"):
            return None
        return APOD(
            title=data.get("title"),
            explanation=data.get("explanation"),
            url=data.get("url"),
            hdurl=data.get("hdurl"),
            media_type=data.get("media_type"),
            date=data.get("date"),
            copyright=data.get("copyright"),
        )
    except Exception:  # noqa: BLE001
        return None
