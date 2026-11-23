from fastapi import APIRouter

from . import analytics, events, health, markets, news, search, space, weather

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(events.router)
api_router.include_router(news.router)
api_router.include_router(weather.router)
api_router.include_router(markets.router)
api_router.include_router(space.router)
api_router.include_router(analytics.router)
api_router.include_router(search.router)
