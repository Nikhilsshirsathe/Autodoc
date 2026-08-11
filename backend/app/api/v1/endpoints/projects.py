"""
Projects API endpoints — CRUD for IPO projects.
"""
from __future__ import annotations

import logging
from typing import Optional
from uuid import uuid4
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status

from app.db.session import get_supabase_admin

logger = logging.getLogger(__name__)
router = APIRouter()


def _db():
    return get_supabase_admin()


# ── List projects ──────────────────────────────────────────────────────────────

@router.get("/")
async def list_projects(user_id: str, limit: int = 50):
    """List all projects created by or shared with a user."""
    try:
        db = _db()
        res = (
            db.table("projects")
            .select("*, team_members(*)")
            .eq("created_by", user_id)
            .limit(limit)
            .execute()
        )
        projects = res.data or []
        return {"projects": projects, "count": len(projects)}
    except Exception as exc:
        logger.error("List projects failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Get single project ─────────────────────────────────────────────────────────

@router.get("/{project_id}")
async def get_project(project_id: str, user_id: str):
    """Fetch a single project by ID."""
    try:
        db = _db()
        res = (
            db.table("projects")
            .select("*, team_members(*)")
            .eq("id", project_id)
            .single()
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="Project not found")
        return res.data
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Get project failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Create project ─────────────────────────────────────────────────────────────

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_project(payload: dict):
    """Create a new IPO project."""
    try:
        db = _db()
        now = datetime.now(timezone.utc).isoformat()
        project = {
            "id": str(uuid4()),
            "name": payload.get("name", ""),
            "company_name": payload.get("company_name", ""),
            "cin": payload.get("cin"),
            "pan": payload.get("pan"),
            "exchange": payload.get("exchange"),
            "industry": payload.get("industry"),
            "status": payload.get("status", "draft"),
            "progress": payload.get("progress", 0),
            "ipo_size": payload.get("ipo_size"),
            "target_filing_date": payload.get("target_filing_date"),
            "documents_uploaded": 0,
            "documents_required": payload.get("documents_required", 20),
            "validation_score": 0,
            "ai_confidence": 0,
            "description": payload.get("description"),
            "registered_address": payload.get("registered_address"),
            "city": payload.get("city"),
            "state": payload.get("state"),
            "pincode": payload.get("pincode"),
            "website": payload.get("website"),
            "incorporation_date": payload.get("incorporation_date"),
            "face_value": payload.get("face_value"),
            "issue_price": payload.get("issue_price"),
            "lot_size": payload.get("lot_size"),
            "created_by": payload.get("created_by", ""),
            "created_at": now,
            "updated_at": now,
        }
        res = db.table("projects").insert(project).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to create project")
        return res.data[0]
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Create project failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Update project ─────────────────────────────────────────────────────────────

@router.patch("/{project_id}")
async def update_project(project_id: str, user_id: str, payload: dict):
    """Partially update a project."""
    try:
        db = _db()
        payload.pop("id", None)
        payload.pop("created_by", None)
        payload["updated_at"] = datetime.now(timezone.utc).isoformat()

        res = (
            db.table("projects")
            .update(payload)
            .eq("id", project_id)
            .eq("created_by", user_id)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="Project not found or not authorised")
        return res.data[0]
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Update project failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Sync project counters ──────────────────────────────────────────────────────

@router.post("/{project_id}/sync-counters")
async def sync_project_counters(project_id: str, user_id: str):
    """
    Recalculate and write documents_uploaded and ai_confidence from actual DB data.
    Useful for backfilling after documents were uploaded before this counter existed.
    """
    try:
        db = _db()

        # Count documents
        doc_res = (
            db.table("documents")
            .select("id", count="exact")
            .eq("project_id", project_id)
            .execute()
        )
        doc_count = doc_res.count or 0

        # Average ai confidence from extracted fields
        doc_ids_res = db.table("documents").select("id").eq("project_id", project_id).execute()
        doc_ids = [d["id"] for d in (doc_ids_res.data or [])]

        avg_confidence = 0
        if doc_ids:
            fields_res = (
                db.table("extracted_fields")
                .select("confidence")
                .in_("document_id", doc_ids)
                .execute()
            )
            confidences = [
                f["confidence"] for f in (fields_res.data or [])
                if f.get("confidence") is not None
            ]
            if confidences:
                avg_confidence = round(sum(confidences) / len(confidences) * 100)

        update_payload = {
            "documents_uploaded": doc_count,
            "updated_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        }
        if avg_confidence > 0:
            update_payload["ai_confidence"] = avg_confidence

        res = db.table("projects").update(update_payload).eq("id", project_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Project not found")

        return {
            "project_id": project_id,
            "documents_uploaded": doc_count,
            "ai_confidence": avg_confidence,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Sync counters failed for %s: %s", project_id, exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Delete project ─────────────────────────────────────────────────────────────

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: str, user_id: str):
    """Delete a project."""
    try:
        db = _db()
        res = (
            db.table("projects")
            .delete()
            .eq("id", project_id)
            .eq("created_by", user_id)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="Project not found or not authorised")
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Delete project failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
