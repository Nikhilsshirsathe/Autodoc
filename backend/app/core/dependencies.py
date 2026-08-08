"""
FastAPI dependency injection — auth helpers and role enforcement.
"""
from __future__ import annotations
from typing import Optional, List
import os

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.security import decode_supabase_jwt
from app.db.session import get_supabase_admin

bearer_scheme = HTTPBearer(auto_error=False)

# JWT secret — set SUPABASE_JWT_SECRET in .env
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")

# Role hierarchy (higher index = more privilege)
ROLE_HIERARCHY: List[str] = [
    "viewer", "legal", "merchant_banker", "analyst", "owner", "admin"
]


def _role_level(role: str) -> int:
    try:
        return ROLE_HIERARCHY.index(role)
    except ValueError:
        return -1


# ── Base auth dependency ───────────────────────────────────────────────────


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    """
    Validates the Bearer token issued by Supabase Auth.
    Returns the decoded JWT payload (sub = user_id, email, role, etc.)
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not SUPABASE_JWT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_JWT_SECRET not configured on server",
        )
    payload = decode_supabase_jwt(credentials.credentials, SUPABASE_JWT_SECRET)
    return payload


def get_current_user_id(user: dict = Depends(get_current_user)) -> str:
    user_id = user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token: missing sub")
    return user_id


# ── Profile-enriched dependency ────────────────────────────────────────────


async def get_current_profile(user: dict = Depends(get_current_user)) -> dict:
    """
    Returns the full profile row from public.profiles, merged with the JWT payload.
    Raises 401 if the profile does not exist.
    """
    user_id = user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token: missing sub")

    db = get_supabase_admin()
    res = db.table("profiles").select("*").eq("id", user_id).single().execute()

    if not res.data:
        raise HTTPException(status_code=401, detail="User profile not found")

    # Merge JWT metadata with profile data (profile takes precedence for role)
    return {**user, **res.data}


# ── Role-enforcement factory ───────────────────────────────────────────────


def require_role(*allowed_roles: str):
    """
    Dependency factory — enforces that the current user has one of the
    specified roles (exact match).

    Usage:
        @router.get("/admin-only")
        async def admin_only(profile = Depends(require_role("admin"))):
            ...

        @router.post("/approve")
        async def approve(profile = Depends(require_role("admin", "merchant_banker"))):
            ...
    """
    async def _check(profile: dict = Depends(get_current_profile)) -> dict:
        role = profile.get("role", "viewer")
        if role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Access denied. Required role: {' or '.join(allowed_roles)}. "
                    f"Your role: {role}"
                ),
            )
        return profile
    return _check


def require_min_role(min_role: str):
    """
    Dependency factory — enforces that the current user's role is at least
    `min_role` in the privilege hierarchy.

    Usage:
        @router.post("/draft")
        async def gen_draft(profile = Depends(require_min_role("analyst"))):
            ...
    """
    async def _check(profile: dict = Depends(get_current_profile)) -> dict:
        role = profile.get("role", "viewer")
        if _role_level(role) < _role_level(min_role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Access denied. Minimum required role: {min_role}. "
                    f"Your role: {role}"
                ),
            )
        return profile
    return _check
