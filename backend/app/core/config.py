"""
Application configuration — reads from environment variables / .env file.
"""
from __future__ import annotations
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── App ──────────────────────────────────────────────────────
    APP_NAME: str = "IPOAI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production"
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:3001"]

    # ── Supabase ─────────────────────────────────────────────────
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""  # server-side, bypasses RLS

    # Direct PostgreSQL URL (for SQLAlchemy / Alembic)
    # postgresql+psycopg2://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
    DATABASE_URL: str = ""

    # ── Storage ──────────────────────────────────────────────────
    STORAGE_BUCKET: str = "documents"
    MAX_UPLOAD_SIZE_MB: int = 50

    # ── OpenAI ───────────────────────────────────────────────────
    OPENAI_API_KEY: str = ""
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
    OPENAI_CHAT_MODEL: str = "gpt-4o-mini"

    # ── Docling / OCR ────────────────────────────────────────────
    ENABLE_OCR: bool = True
    OCR_LANGUAGE: str = "eng"
    DOCLING_ARTIFACTS_PATH: str = ""

    # ── Task queue ───────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    USE_CELERY: bool = False

    LOG_LEVEL: str = "INFO"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
