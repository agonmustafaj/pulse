from __future__ import annotations

import re
from datetime import datetime, timezone

from app.cache import cache
from app.providers import space as space_provider
from app.schemas.space import ISSPosition, SpaceResponse

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _valid_apod_date(date: str | None) -> bool:
    if not date or not _DATE_RE.match(date):
        return False
    try:
        d = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        return False
    minimum = datetime(1995, 6, 16, tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    return minimum <= d <= now


async def get_iss() -> ISSPosition:
    cached = await cache.get("space:iss")
    if cached:
        return ISSPosition.model_validate(cached)
    iss = await space_provider.fetch_iss()
    await cache.set("space:iss", iss.model_dump(mode="json"), 20)
    return iss


async def get_apod(date: str | None = None) -> dict:
    if date and not _valid_apod_date(date):
        return {
            "ok": False,
            "missing": True,
            "date": date,
            "message": "Date must be YYYY-MM-DD between 1995-06-16 and today.",
            "apod": None,
            "source": "NASA APOD",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "cached": False,
        }

    cache_key = f"space:apod:{date}" if date else "space:apod:today"
    cached = await cache.get(cache_key)
    if cached:
        return {**cached, "cached": True}

    try:
        apod = await space_provider.fetch_apod(date)
    except Exception as exc:  # noqa: BLE001
        return {
            "ok": False,
            "missing": False,
            "date": date,
            "message": str(exc),
            "apod": None,
            "source": "NASA APOD",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "cached": False,
        }

    resp = {
        "ok": apod is not None,
        "missing": apod is None,
        "date": (apod.date if apod else date),
        "message": None if apod else "No Astronomy Picture of the Day for this date.",
        "apod": apod.model_dump(mode="json") if apod else None,
        "source": "NASA APOD",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "cached": False,
    }
    if apod:
        await cache.set(cache_key, resp, 600)
    return resp


async def get_space(date: str | None = None) -> SpaceResponse:
    if not date:
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
        apod_payload = await get_apod(date)
        if apod_payload.get("apod"):
            from app.schemas.space import APOD

            apod = APOD.model_validate(apod_payload["apod"])
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
    if not date:
        await cache.set("space:bundle", resp.model_dump(mode="json"), 120)
    return resp
