"""
Security utilities: JWT verification via Supabase auth.
"""
from __future__ import annotations
import jwt
from fastapi import HTTPException, status


def decode_supabase_jwt(token: str, jwt_secret: str) -> dict:
    """
    Decode and verify a Supabase-issued JWT.
    The JWT secret is available in Supabase Dashboard → Settings → API → JWT Secret.
    """
    try:
        payload = jwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
        )
