from datetime import datetime, timezone

from fastapi import APIRouter

from app.schemas.analytics import AnalyticsResponse
from app.services import analytics_service

router = APIRouter(tags=["analytics"])


@router.get("/analytics", response_model=AnalyticsResponse)
async def analytics():
    try:
        return await analytics_service.get_analytics()
    except Exception as exc:  # noqa: BLE001
        return AnalyticsResponse(ok=False, source="analytics", updated_at=datetime.now(timezone.utc), message=str(exc))
