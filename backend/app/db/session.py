"""
Database session — Supabase Python client + optional SQLAlchemy.
"""
from __future__ import annotations
from typing import Generator

from supabase import create_client, Client
from app.core.config import settings


# ── Supabase clients ─────────────────────────────────────────────────────────
_admin_client: Client | None = None
_anon_client: Client | None = None


def get_supabase_admin() -> Client:
    """Service-role client — bypasses RLS. Use for server-side writes."""
    global _admin_client
    if _admin_client is None:
        _admin_client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY,
        )
    return _admin_client


def get_supabase_anon() -> Client:
    """Anon client — RLS applies. Use when proxying user requests."""
    global _anon_client
    if _anon_client is None:
        _anon_client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_ANON_KEY,
        )
    return _anon_client


# ── Optional SQLAlchemy (for complex queries / Alembic) ──────────────────────
_engine = None
_SessionLocal = None


def _init_sqlalchemy():
    global _engine, _SessionLocal
    if not settings.DATABASE_URL:
        return
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    _engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
    )
    _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)


_init_sqlalchemy()


def get_db() -> Generator:
    if _SessionLocal is None:
        raise RuntimeError("DATABASE_URL not configured")
    db = _SessionLocal()
    try:
        yield db
    finally:
        db.close()
