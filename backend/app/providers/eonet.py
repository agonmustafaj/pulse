from __future__ import annotations

from datetime import datetime, timezone

from app.schemas.events import Event
from app.utils.http import fetch_json

EONET_URL = "https://eonet.gsfc.nasa.gov/api/v3/events"


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        return None


async def fetch_natural_events(limit: int = 50) -> list[Event]:
    data = await fetch_json(EONET_URL, params={"status": "open", "limit": limit})
    events: list[Event] = []
    for item in data.get("events", []):
        categories = item.get("categories") or []
        cat_title = categories[0].get("title") if categories else "Natural event"
        cat_id = categories[0].get("id") if categories else "natural"
        geometry = item.get("geometry") or []
        lat = lon = None
        timestamp = None
        if geometry:
            g = geometry[-1]
            coords = g.get("coordinates") or []
            if g.get("type") == "Point" and len(coords) >= 2:
                lon, lat = coords[0], coords[1]
            timestamp = _parse_dt(g.get("date"))
        sources = item.get("sources") or []
        source_url = sources[0].get("url") if sources else item.get("link")
        events.append(
            Event(
                id=f"eonet-{item.get('id')}",
                title=item.get("title") or "Natural event",
                description=item.get("description"),
                category="environment",
                latitude=lat,
                longitude=lon,
                location_name=None,
                timestamp=timestamp,
                source="NASA EONET",
                source_url=source_url,
                severity=None,
                metadata={"eonet_category": cat_id, "eonet_category_title": cat_title, "type": "natural_event"},
            )
        )
    return events
