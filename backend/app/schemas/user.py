"""Pydantic schemas for user/auth responses."""
from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


class ProfileOut(BaseModel):
    id: str
    email: str
    full_name: str = ""
    role: str = "owner"
    role_text: Optional[str] = None
    avatar_url: Optional[str] = None
    last_seen_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_token: Optional[str] = None
    user: Optional[dict] = None


class RoleUpdateRequest(BaseModel):
    role: str
