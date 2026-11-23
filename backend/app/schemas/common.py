from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ApiMeta(BaseModel):
    ok: bool = True
    source: str | list[str]
    updated_at: datetime
    cached: bool = False
    message: str | None = None


class ErrorResponse(BaseModel):
    ok: bool = False
    error: str
    source: str | None = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    detail: Any | None = None
