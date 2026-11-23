"""Live WebSocket: heartbeats + periodic ISS / event count snapshots."""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services import events_service, space_service

router = APIRouter()


@router.websocket("/ws/live")
async def live_ws(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            try:
                iss = await space_service.get_iss()
                events = await events_service.get_events(limit=5)
                payload = {
                    "type": "snapshot",
                    "ts": datetime.now(timezone.utc).isoformat(),
                    "iss": iss.model_dump(mode="json"),
                    "latest_events": [e.model_dump(mode="json") for e in events.items[:5]],
                    "event_total": events.total,
                }
                await websocket.send_text(json.dumps(payload, default=str))
            except Exception as exc:  # noqa: BLE001
                await websocket.send_text(
                    json.dumps({"type": "error", "message": str(exc), "ts": datetime.now(timezone.utc).isoformat()})
                )
            # Heartbeat / wait; allow client ping messages without blocking long
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=15.0)
            except asyncio.TimeoutError:
                await websocket.send_text(json.dumps({"type": "heartbeat", "ts": datetime.now(timezone.utc).isoformat()}))
    except WebSocketDisconnect:
        return
