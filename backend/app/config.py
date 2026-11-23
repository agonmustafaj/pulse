from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "PULSE"
    nasa_api_key: str = ""
    news_api_key: str = ""
    redis_url: str = ""
    cors_origins: str = "*"
    host: str = "0.0.0.0"
    port: int = 8000
    http_timeout: float = 20.0

    @property
    def cors_origin_list(self) -> list[str]:
        raw = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        return raw or ["*"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
