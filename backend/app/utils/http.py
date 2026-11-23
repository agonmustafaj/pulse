"""Shared HTTP helpers with timeout and light retry."""

from __future__ import annotations

import asyncio
from typing import Any

import httpx

from app.config import get_settings

DEFAULT_HEADERS = {
    "User-Agent": "PULSE/1.0 (+https://github.com/agonmustafaj/pulse; global-signal-platform)",
    "Accept": "application/json, text/xml, application/rss+xml, */*",
}


async def fetch_json(
    url: str,
    *,
    params: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    retries: int = 2,
) -> Any:
    settings = get_settings()
    merged = {**DEFAULT_HEADERS, **(headers or {})}
    last_exc: Exception | None = None
    for attempt in range(retries + 1):
        try:
            async with httpx.AsyncClient(timeout=settings.http_timeout, follow_redirects=True) as client:
                resp = await client.get(url, params=params, headers=merged)
                resp.raise_for_status()
                return resp.json()
        except Exception as exc:  # noqa: BLE001 — surface as provider failure upstream
            last_exc = exc
            if attempt < retries:
                await asyncio.sleep(0.4 * (attempt + 1))
    raise RuntimeError(f"GET {url} failed: {last_exc}") from last_exc


async def fetch_text(
    url: str,
    *,
    params: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    retries: int = 2,
) -> str:
    settings = get_settings()
    merged = {**DEFAULT_HEADERS, **(headers or {})}
    last_exc: Exception | None = None
    for attempt in range(retries + 1):
        try:
            async with httpx.AsyncClient(timeout=settings.http_timeout, follow_redirects=True) as client:
                resp = await client.get(url, params=params, headers=merged)
                resp.raise_for_status()
                return resp.text
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            if attempt < retries:
                await asyncio.sleep(0.4 * (attempt + 1))
    raise RuntimeError(f"GET {url} failed: {last_exc}") from last_exc
