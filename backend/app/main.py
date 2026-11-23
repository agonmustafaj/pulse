"""PULSE FastAPI application."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import api_router
from app.config import get_settings

settings = get_settings()

app = FastAPI(title="PULSE API", version="1.0.0", docs_url="/api/docs", redoc_url="/api/redoc")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
# Register WebSocket explicitly (include_router nesting can hide WS in some setups)
from app.api.websocket import live_ws

app.add_api_websocket_route("/ws/live", live_ws)# Prefer built Pages output (dist), fall back to frontend source for local-only work
ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / "dist"
FRONTEND = ROOT / "frontend"
STATIC_ROOT = DIST if DIST.exists() else FRONTEND


@app.get("/config.js")
async def runtime_config():
    """Injected at runtime so Pages build stays key-free; API base from env."""
    # Empty string = same origin (when API serves the SPA)
    api_base = ""
    # Allow override via env for split deploy
    import os

    api_base = os.getenv("PULSE_API_BASE", os.getenv("VITE_API_BASE", ""))
    body = f'window.PULSE_API_BASE = {api_base!r};\n'
    from fastapi.responses import Response

    return Response(content=body, media_type="application/javascript")


if STATIC_ROOT.exists():
    assets = STATIC_ROOT / "assets"
    if assets.exists():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/")
    async def index():
        return FileResponse(STATIC_ROOT / "index.html")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        # Don't capture API
        if full_path.startswith("api") or full_path.startswith("ws"):
            from fastapi.responses import JSONResponse

            return JSONResponse({"ok": False, "error": "Not found"}, status_code=404)
        candidate = STATIC_ROOT / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(STATIC_ROOT / "index.html")
