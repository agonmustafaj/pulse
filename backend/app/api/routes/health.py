from datetime import datetime, timezone

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    return {
        "ok": True,
        "status": "online",
        "service": "PULSE",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
