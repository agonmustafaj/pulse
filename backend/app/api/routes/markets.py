from datetime import datetime, timezone

from fastapi import APIRouter, Query

from app.schemas.markets import MarketsResponse
from app.services import markets_service

router = APIRouter(tags=["markets"])


@router.get("/markets", response_model=MarketsResponse)
async def markets(category: str | None = None):
    try:
        return await markets_service.get_markets(category=category)
    except Exception as exc:  # noqa: BLE001
        return MarketsResponse(
            ok=False,
            source="markets",
            updated_at=datetime.now(timezone.utc),
            message=str(exc),
            items=[],
        )


@router.get("/markets/{symbol}/history")
async def market_history(symbol: str, range: str = Query("1m", alias="range")):  # noqa: A002
    try:
        hist = await markets_service.get_history(symbol, range)
        return {"ok": True, **hist.model_dump(mode="json"), "updated_at": datetime.now(timezone.utc).isoformat()}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "symbol": symbol, "range": range, "points": [], "error": str(exc)}
