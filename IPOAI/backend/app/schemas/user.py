"""Pydantic schemas for user/auth responses."""
from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


class ProfileOut(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    role: str
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_token: Optional[str] = None
    user: Optional[dict] = None
