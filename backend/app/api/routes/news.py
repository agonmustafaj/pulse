from datetime import datetime, timezone

from fastapi import APIRouter, Query

from app.schemas.news import NewsResponse
from app.services import news_service

router = APIRouter(tags=["news"])


@router.get("/news", response_model=NewsResponse)
async def list_news(
    category: str | None = None,
    query: str | None = None,
    source: str | None = None,
    limit: int = Query(50, ge=1, le=200),
):
    try:
        return await news_service.get_news(category=category, query=query, source=source, limit=limit)
    except Exception as exc:  # noqa: BLE001
        return NewsResponse(
            ok=False,
            source="news",
            updated_at=datetime.now(timezone.utc),
            message=str(exc),
            items=[],
            total=0,
        )
