from __future__ import annotations

from datetime import datetime, timezone

from app.schemas.events import Event
from app.utils.http import fetch_json

FEEDS = {
    "significant_week": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson",
    "m45_day": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson",
    "m25_day": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson",
}


def _severity(mag: float | None) -> str | None:
    if mag is None:
        return None
    if mag >= 6:
        return "high"
    if mag >= 4.5:
        return "medium"
    return "low"


async def fetch_earthquakes(feed: str = "m45_day") -> list[Event]:
    url = FEEDS.get(feed, FEEDS["m45_day"])
    data = await fetch_json(url)
    events: list[Event] = []
    for feature in data.get("features", []):
        props = feature.get("properties") or {}
        geom = feature.get("geometry") or {}
        coords = geom.get("coordinates") or [None, None, None]
        lon, lat = coords[0], coords[1]
        mag = props.get("mag")
        ts = props.get("time")
        timestamp = datetime.fromtimestamp(ts / 1000, tz=timezone.utc) if ts else None
        eid = f"usgs-{feature.get('id') or props.get('code')}"
        place = props.get("place") or "Unknown location"
        title = f"M{mag}: {place}" if mag is not None else place
        events.append(
            Event(
                id=eid,
                title=title,
                description=props.get("title") or title,
                category="natural",
                latitude=lat,
                longitude=lon,
                location_name=place,
                timestamp=timestamp,
                source="USGS",
                source_url=props.get("url"),
                severity=_severity(mag),
                metadata={
                    "magnitude": mag,
                    "depth_km": coords[2] if len(coords) > 2 else None,
                    "felt": props.get("felt"),
                    "tsunami": props.get("tsunami"),
                    "alert": props.get("alert"),
                    "type": "earthquake",
                },
            )
        )
    return events
