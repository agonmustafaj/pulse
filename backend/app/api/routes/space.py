from datetime import datetime, timezone

from fastapi import APIRouter

from app.schemas.space import SpaceResponse
from app.services import space_service

router = APIRouter(tags=["space"])


@router.get("/space", response_model=SpaceResponse)
async def space():
    try:
        return await space_service.get_space()
    except Exception as exc:  # noqa: BLE001
        return SpaceResponse(ok=False, source="space", updated_at=datetime.now(timezone.utc), message=str(exc))


@router.get("/space/iss")
async def iss():
    try:
        pos = await space_service.get_iss()
        return {"ok": True, **pos.model_dump(mode="json")}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc), "updated_at": datetime.now(timezone.utc).isoformat()}
