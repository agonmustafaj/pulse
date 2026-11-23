from __future__ import annotations

from datetime import datetime, timezone

from app.cache import cache
from app.providers import eonet, usgs
from app.schemas.events import Event, EventsResponse

CACHE_KEY = "events:all"
TTL = 300


async def get_events(
    category: str | None = None,
    limit: int = 100,
    region: str | None = None,
) -> EventsResponse:
    cached = await cache.get(CACHE_KEY)
    if cached:
        items = [Event.model_validate(e) for e in cached["items"]]
        meta_cached = True
        sources = cached["source"]
        updated = datetime.fromisoformat(cached["updated_at"])
    else:
        items: list[Event] = []
        sources: list[str] = []
        errors: list[str] = []
        try:
            quakes = await usgs.fetch_earthquakes("m45_day")
            items.extend(quakes)
            sources.append("USGS")
        except Exception as exc:  # noqa: BLE001
            errors.append(f"USGS: {exc}")
        try:
            natural = await eonet.fetch_natural_events(40)
            items.extend(natural)
            sources.append("NASA EONET")
        except Exception as exc:  # noqa: BLE001
            errors.append(f"EONET: {exc}")
        try:
            significant = await usgs.fetch_earthquakes("significant_week")
            existing = {e.id for e in items}
            for e in significant:
                if e.id not in existing:
                    items.append(e)
            if "USGS" not in sources:
                sources.append("USGS")
        except Exception:  # noqa: BLE001
            pass
        items.sort(key=lambda e: e.timestamp or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
        updated = datetime.now(timezone.utc)
        await cache.set(
            CACHE_KEY,
            {
                "items": [e.model_dump(mode="json") for e in items],
                "source": sources,
                "updated_at": updated.isoformat(),
            },
            TTL,
        )
        meta_cached = False
        if errors and not items:
            return EventsResponse(
                ok=False,
                source=sources or "events",
                updated_at=updated,
                cached=False,
                message="; ".join(errors),
                items=[],
                total=0,
            )

    if category:
        items = [e for e in items if e.category.lower() == category.lower() or (e.metadata or {}).get("type") == category]
    if region:
        r = region.lower()
        items = [e for e in items if e.location_name and r in e.location_name.lower()]

    limited = items[: max(1, min(limit, 500))]
    return EventsResponse(
        ok=True,
        source=sources if isinstance(sources, list) else [sources],
        updated_at=updated,
        cached=meta_cached,
        items=limited,
        total=len(items),
    )


async def get_event(event_id: str) -> Event | None:
    resp = await get_events(limit=500)
    for e in resp.items:
        if e.id == event_id:
            return e
    return None
