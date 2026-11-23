from datetime import datetime, timezone

from fastapi import APIRouter, Query

from app.schemas.search import SearchResponse
from app.services import search_service

router = APIRouter(tags=["search"])


@router.get("/search", response_model=SearchResponse)
async def search(q: str = Query("", max_length=120)):
    try:
        return await search_service.search(q)
    except Exception as exc:  # noqa: BLE001
        return SearchResponse(
            ok=False,
            source="search",
            updated_at=datetime.now(timezone.utc),
            query=q,
            message=str(exc),
            items=[],
        )
