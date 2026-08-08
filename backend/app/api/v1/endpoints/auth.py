"""
Auth endpoints — /auth/me and session management.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencies import get_current_profile, require_min_role
from app.db.session import get_supabase_admin
from app.schemas.user import ProfileOut

logger = logging.getLogger(__name__)
router = APIRouter()


# ── GET /auth/me ─────────────────────────────────────────────────────────────

@router.get("/me", response_model=ProfileOut, summary="Get current user profile")
async def get_me(profile: dict = Depends(get_current_profile)):
    """
    Returns the authenticated user's full profile including their role.
    The frontend calls this after login to hydrate the AuthContext.
    """
    return ProfileOut(
        id=profile["id"],
        email=profile["email"],
        full_name=profile.get("full_name") or "",
        role=profile.get("role", "viewer"),
        avatar_url=profile.get("avatar_url"),
        created_at=profile["created_at"],
    )


# ── POST /auth/heartbeat ──────────────────────────────────────────────────────

@router.post("/heartbeat", status_code=204, summary="Record session activity")
async def heartbeat(profile: dict = Depends(get_current_profile)):
    """
    Updates `last_seen_at` for the current user.
    Called by the frontend's idle-activity tracker every ~30 s.
    """
    try:
        db = get_supabase_admin()
        db.table("profiles").update(
            {"last_seen_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", profile["id"]).execute()
    except Exception as exc:
        logger.warning("Heartbeat update failed for user %s: %s", profile.get("id"), exc)
    return None


# ── GET /auth/me/sessions ─────────────────────────────────────────────────────

@router.get("/me/sessions", summary="List active sessions for current user")
async def list_sessions(profile: dict = Depends(get_current_profile)):
    """
    Returns the user's recorded sessions from user_sessions table.
    """
    try:
        db = get_supabase_admin()
        res = (
            db.table("user_sessions")
            .select("id, ip_address, user_agent, last_active_at, created_at, is_revoked")
            .eq("user_id", profile["id"])
            .eq("is_revoked", False)
            .order("last_active_at", desc=True)
            .limit(20)
            .execute()
        )
        return {"sessions": res.data or []}
    except Exception as exc:
        logger.error("List sessions failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ── DELETE /auth/me/sessions/{session_id} ────────────────────────────────────

@router.delete("/me/sessions/{session_id}", status_code=204, summary="Revoke a session")
async def revoke_session(session_id: str, profile: dict = Depends(get_current_profile)):
    """
    Marks a session as revoked (soft delete).
    Users can only revoke their own sessions; admins can revoke any.
    """
    try:
        db = get_supabase_admin()
        query = (
            db.table("user_sessions")
            .update({"is_revoked": True})
            .eq("id", session_id)
        )
        # Non-admins can only revoke their own sessions
        if profile.get("role") != "admin":
            query = query.eq("user_id", profile["id"])

        res = query.execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Session not found")
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Revoke session failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
    return None


# ── Admin: list all users ─────────────────────────────────────────────────────

@router.get(
    "/users",
    summary="[Admin] List all user profiles",
    dependencies=[Depends(require_min_role("admin"))],
)
async def list_users(limit: int = 100, offset: int = 0):
    """
    Returns all user profiles. Restricted to admin role.
    """
    try:
        db = get_supabase_admin()
        res = (
            db.table("profiles")
            .select("id, email, full_name, role, created_at, last_seen_at")
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return {"users": res.data or [], "count": len(res.data or [])}
    except Exception as exc:
        logger.error("List users failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Admin: update user role ───────────────────────────────────────────────────

@router.patch(
    "/users/{user_id}/role",
    summary="[Admin] Update a user's role",
)
async def update_user_role(
    user_id: str,
    payload: dict,
    admin: dict = Depends(require_min_role("admin")),
):
    """
    Updates the role of any user. Restricted to admin.
    Body: { "role": "analyst" }
    """
    new_role = payload.get("role")
    valid_roles = {"admin", "owner", "analyst", "merchant_banker", "legal", "viewer"}
    if new_role not in valid_roles:
        raise HTTPException(status_code=422, detail=f"Invalid role. Must be one of: {valid_roles}")

    try:
        db = get_supabase_admin()
        res = (
            db.table("profiles")
            .update({"role": new_role})
            .eq("id", user_id)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="User not found")
        return {"user_id": user_id, "role": new_role}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Update role failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
