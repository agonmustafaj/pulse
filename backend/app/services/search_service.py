from __future__ import annotations

import re
from datetime import datetime, timezone

from app.schemas.search import SearchResponse, SearchResult
from app.services import space_service

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

SPACE_HINTS = [
    ("apod", "/", "Astronomy Picture of the Day", "Explore"),
    ("astronomy", "/", "Astronomy Picture of the Day", "Explore"),
    ("cosmos", "/", "Explore the cosmos", "Explore"),
    ("orbit", "/space", "Orbit", "Orbit"),
    ("planet", "/space?focus=planets", "Planets in orbit", "Orbit"),
    ("mars", "/space?focus=planets", "Mars & solar system", "Orbit"),
    ("jupiter", "/space?focus=planets", "Jupiter & solar system", "Orbit"),
    ("iss", "/space?focus=iss", "International Space Station", "Orbit"),
    ("station", "/space?focus=iss", "International Space Station", "Orbit"),
    ("launch", "/space?focus=launches", "Upcoming launches", "Orbit"),
    ("rocket", "/space?focus=launches", "Upcoming launches", "Orbit"),
    ("neo", "/space?focus=neos", "Near-Earth objects", "Orbit"),
    ("asteroid", "/space?focus=neos", "Near-Earth objects", "Orbit"),
]


async def search(q: str) -> SearchResponse:
    query = (q or "").strip()
    if len(query) < 2:
        return SearchResponse(
            ok=True,
            source="search",
            updated_at=datetime.now(timezone.utc),
            items=[],
            query=query,
            message="Enter at least 2 characters",
        )

    ql = query.lower()
    results: list[SearchResult] = []

    for hint, route, title, category in SPACE_HINTS:
        if hint in ql:
            results.append(
                SearchResult(
                    id=f"hint-{hint}",
                    title=title,
                    subtitle=category,
                    category="space",
                    route=route,
                )
            )

    if DATE_RE.match(query):
        results.append(
            SearchResult(
                id=f"apod-{query}",
                title=f"APOD {query}",
                subtitle="Astronomy Picture of the Day",
                category="apod",
                route=f"/?date={query}",
                meta={"date": query},
            )
        )

    try:
        space = await space_service.get_space()
        for launch in space.launches or []:
            name = getattr(launch, "name", "") or ""
            provider = getattr(launch, "provider", None) or ""
            launch_id = getattr(launch, "id", None) or name
            hay = f"{name} {provider}".lower()
            if ql in hay:
                results.append(
                    SearchResult(
                        id=f"launch-{launch_id}",
                        title=name,
                        subtitle=provider or "Launch",
                        category="launch",
                        route="/space?focus=launches",
                    )
                )
    except Exception:  # noqa: BLE001
        pass

    for path, title in (("/", "Explore"), ("/space", "Orbit")):
        if ql in title.lower() or (path != "/" and ql in path.strip("/")):
            results.append(
                SearchResult(
                    id=f"sec-{path or 'home'}",
                    title=title,
                    subtitle="Go to section",
                    category="section",
                    route=path,
                )
            )

    seen: set[str] = set()
    unique: list[SearchResult] = []
    for r in results:
        if r.id in seen:
            continue
        seen.add(r.id)
        unique.append(r)

    return SearchResponse(
        ok=True,
        source=["space", "apod"],
        updated_at=datetime.now(timezone.utc),
        items=unique[:30],
        query=query,
    )
