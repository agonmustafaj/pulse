from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from app.schemas.events import EventsResponse
from app.services import events_service

router = APIRouter(tags=["events"])


@router.get("/events", response_model=EventsResponse)
async def list_events(
    category: str | None = None,
    region: str | None = None,
    limit: int = Query(100, ge=1, le=500),
):
    try:
        return await events_service.get_events(category=category, region=region, limit=limit)
    except Exception as exc:  # noqa: BLE001
        return EventsResponse(
            ok=False,
            source="events",
            updated_at=datetime.now(timezone.utc),
            message=str(exc),
            items=[],
            total=0,
        )


@router.get("/events/{event_id}")
async def event_detail(event_id: str):
    event = await events_service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"ok": True, "item": event, "updated_at": datetime.now(timezone.utc)}
