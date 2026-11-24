from datetime import datetime, timezone

from fastapi import APIRouter, Query

from app.schemas.space import SpaceResponse
from app.services import space_service

router = APIRouter(tags=["space"])


@router.get("/space", response_model=SpaceResponse)
async def space(date: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$")):
    try:
        return await space_service.get_space(date=date)
    except Exception as exc:  # noqa: BLE001
        return SpaceResponse(ok=False, source="space", updated_at=datetime.now(timezone.utc), message=str(exc))


@router.get("/space/iss")
async def iss():
    try:
        pos = await space_service.get_iss()
        return {"ok": True, **pos.model_dump(mode="json")}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc), "updated_at": datetime.now(timezone.utc).isoformat()}


@router.get("/space/apod")
async def apod(date: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$")):
    try:
        return await space_service.get_apod(date=date)
    except Exception as exc:  # noqa: BLE001
        return {
            "ok": False,
            "missing": False,
            "apod": None,
            "message": str(exc),
            "source": "NASA APOD",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
