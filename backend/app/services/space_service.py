from __future__ import annotations

from datetime import datetime, timezone

from app.cache import cache
from app.providers import space as space_provider
from app.schemas.space import ISSPosition, SpaceResponse


async def get_iss() -> ISSPosition:
    cached = await cache.get("space:iss")
    if cached:
        return ISSPosition.model_validate(cached)
    iss = await space_provider.fetch_iss()
    await cache.set("space:iss", iss.model_dump(mode="json"), 20)
    return iss


async def get_space() -> SpaceResponse:
    cached = await cache.get("space:bundle")
    if cached:
        return SpaceResponse.model_validate({**cached, "cached": True})

    iss = None
    launches = []
    apod = None
    sources: list[str] = []
    try:
        iss = await get_iss()
        sources.append(iss.source)
    except Exception:  # noqa: BLE001
        pass
    try:
        launches = await space_provider.fetch_launches(12)
        sources.append("The Space Devs")
    except Exception:  # noqa: BLE001
        launches = []
    try:
        apod = await space_provider.fetch_apod()
        if apod:
            sources.append("NASA APOD")
    except Exception:  # noqa: BLE001
        apod = None

    resp = SpaceResponse(
        ok=bool(iss or launches or apod),
        source=sources or ["space"],
        updated_at=datetime.now(timezone.utc),
        cached=False,
        iss=iss,
        launches=launches,
        apod=apod,
    )
    await cache.set("space:bundle", resp.model_dump(mode="json"), 120)
    return resp
