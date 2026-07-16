"""
FastAPI dependency injection.
"""
from __future__ import annotations
from typing import Optional
import os

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.security import decode_supabase_jwt

bearer_scheme = HTTPBearer(auto_error=False)

# JWT secret — set SUPABASE_JWT_SECRET in .env
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")


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
