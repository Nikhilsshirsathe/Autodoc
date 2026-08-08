"""
Document API endpoints — upload, pipeline trigger, status polling, listing.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.services.document_service import DocumentService
from app.services.pipeline_tasks import dispatch_pipeline

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_service() -> DocumentService:
    return DocumentService()


# ── Upload ─────────────────────────────────────────────────────────────────────

@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: str = Form(...),
    project_id: Optional[str] = Form(None),
    company_id: Optional[str] = Form(None),
    doc_type: str = Form("ipo_prospectus"),
    auto_process: bool = Form(True),
):
    """
    Upload a document to Supabase Storage and create a DB record.

    - `file`: The document file (PDF, PNG, JPG).
    - `user_id`: ID of the uploading user (from Supabase auth).
    - `project_id`: Optional project ID to associate the document.
    - `company_id`: Optional company ID (legacy, prefer project_id).
    - `doc_type`: Document category label.
    - `auto_process`: If true, automatically triggers the extraction pipeline.

    Returns the created document record. Status will be 'uploaded' or 'processing'
    if auto_process is true.
    """
    # Validate file size
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB} MB",
        )

    # Validate mime type
    allowed_mime = {
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/tiff",
    }
    mime = file.content_type or "application/octet-stream"
    if mime not in allowed_mime:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {mime}. Allowed: PDF, PNG, JPG, TIFF",
        )

    try:
        service = _get_service()
        doc = service.upload_document(
            file_bytes=content,
            filename=file.filename or "unnamed",
            mime_type=mime,
            user_id=user_id,
            project_id=project_id,
            company_id=company_id,
            doc_type=doc_type,
        )

        if auto_process:
            dispatch_pipeline(doc["id"], background_tasks=background_tasks)
            doc["status"] = "processing"

        return doc

    except Exception as exc:
        logger.error("Upload failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(exc)}",
        )


# ── Trigger pipeline manually ──────────────────────────────────────────────────

@router.post("/{document_id}/process")
async def process_document(
    document_id: str,
    background_tasks: BackgroundTasks,
):
    """
    Manually trigger (or re-trigger) the extraction pipeline for a document.
    Useful for reprocessing failed documents.
    """
    try:
        dispatch_pipeline(document_id, background_tasks=background_tasks)
        return {"document_id": document_id, "status": "processing", "message": "Pipeline started"}
    except Exception as exc:
        logger.error("Failed to start pipeline for %s: %s", document_id, exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Status polling ─────────────────────────────────────────────────────────────

@router.get("/{document_id}/status")
async def get_pipeline_status(document_id: str):
    """
    Poll the processing status and extracted data counts for a document.

    Response fields:
    - `status`: uploaded | processing | completed | failed
    - `page_count`: Number of pages extracted
    - `extracted_fields_count`: Number of structured fields found
    - `extracted_tables_count`: Number of tables found
    - `chunks_count`: Number of text chunks for RAG
    - `error_message`: Error detail if status is 'failed'
    """
    try:
        service = _get_service()
        result = service.get_pipeline_status(document_id)
        if result["status"] == "not_found":
            raise HTTPException(status_code=404, detail=f"Document {document_id} not found")
        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Status check failed for %s: %s", document_id, exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ── List documents ─────────────────────────────────────────────────────────────

@router.get("/")
async def list_documents(user_id: str, limit: int = 50):
    """
    List all documents uploaded by a user.
    Pass `user_id` as a required query param.
    """
    try:
        service = _get_service()
        docs = service.list_documents(user_id=user_id, limit=limit)
        return {"documents": docs, "count": len(docs)}
    except Exception as exc:
        logger.error("List documents failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/list")
async def list_documents_filtered(
    user_id: Optional[str] = None,
    company_id: Optional[str] = None,
    doc_type: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
):
    """
    List documents with optional filters.

    All parameters are optional:
    - `user_id`: filter by uploader
    - `company_id`: filter by associated company/project
    - `doc_type`: filter by document type label
    - `status`: filter by processing status (uploaded | processing | completed | failed)
    - `limit`: max results to return (default 50)
    - `offset`: pagination offset (default 0)
    """
    try:
        from app.db.session import get_supabase_admin

        supabase = get_supabase_admin()
        query = supabase.table("documents").select("*")

        if user_id:
            query = query.eq("uploaded_by", user_id)
        if company_id:
            query = query.eq("company_id", company_id)
        if doc_type:
            query = query.eq("doc_type", doc_type)
        if status:
            query = query.eq("status", status)

        query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
        result = query.execute()
        docs = result.data or []
        return {"documents": docs, "count": len(docs), "offset": offset, "limit": limit}
    except Exception as exc:
        logger.error("List documents (filtered) failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Extracted data ─────────────────────────────────────────────────────────────

@router.get("/{document_id}/signed-url")
async def get_signed_url(document_id: str, expires_in: int = 3600):
    """Get a signed URL to view the original document file."""
    try:
        from app.db.session import get_supabase_admin
        supabase = get_supabase_admin()
        doc_res = (
            supabase.table("documents")
            .select("file_path, storage_bucket")
            .eq("id", document_id)
            .single()
            .execute()
        )
        if not doc_res.data:
            raise HTTPException(status_code=404, detail="Document not found")

        file_path = doc_res.data["file_path"]
        bucket = doc_res.data["storage_bucket"]

        signed = supabase.storage.from_(bucket).create_signed_url(file_path, expires_in)
        if not signed or not signed.get("signedURL"):
            raise HTTPException(status_code=500, detail="Failed to generate signed URL")

        return {"signed_url": signed["signedURL"], "expires_in": expires_in}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Signed URL failed for %s: %s", document_id, exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{document_id}/fields")
async def get_extracted_fields(document_id: str):
    """Return all extracted structured fields for a document."""
    service = _get_service()
    fields = service.get_extracted_fields(document_id)
    return {"document_id": document_id, "fields": fields}


@router.get("/{document_id}/pages")
async def get_document_pages(document_id: str):
    """Return all extracted pages (text content) for a document."""
    try:
        from app.db.session import get_supabase_admin
        supabase = get_supabase_admin()
        res = (
            supabase.table("document_pages")
            .select("*")
            .eq("document_id", document_id)
            .order("page_number")
            .execute()
        )
        return {"document_id": document_id, "pages": res.data or []}
    except Exception as exc:
        logger.error("Get pages failed for %s: %s", document_id, exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{document_id}/tables")
async def get_extracted_tables(document_id: str):
    """Return all extracted tables for a document."""
    service = _get_service()
    tables = service.get_extracted_tables(document_id)
    return {"document_id": document_id, "tables": tables}


# ── Update document ────────────────────────────────────────────────────────────

@router.patch("/{document_id}")
async def update_document(document_id: str, user_id: str, payload: dict):
    """
    Update mutable fields on a document (currently: company_id, doc_type).
    Caller must be the document owner.
    """
    try:
        from app.db.session import get_supabase_admin

        supabase = get_supabase_admin()

        # Verify ownership
        result = (
            supabase.table("documents")
            .select("id, uploaded_by")
            .eq("id", document_id)
            .single()
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Document not found")
        if result.data["uploaded_by"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorised to update this document")

        # Only allow safe fields
        allowed = {"project_id", "company_id", "doc_type"}
        update_data = {k: v for k, v in payload.items() if k in allowed}
        if not update_data:
            raise HTTPException(status_code=400, detail="No updatable fields provided")

        updated = (
            supabase.table("documents")
            .update(update_data)
            .eq("id", document_id)
            .execute()
        )
        return updated.data[0] if updated.data else {"id": document_id, **update_data}

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Update document failed for %s: %s", document_id, exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Single document ────────────────────────────────────────────────────────────

@router.get("/{document_id}")
async def get_document(document_id: str, user_id: str):
    """Fetch a single document record."""
    service = _get_service()
    doc = service.get_document(document_id, user_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


# ── Delete ─────────────────────────────────────────────────────────────────────

@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(document_id: str, user_id: str):
    """Delete a document and its storage file."""
    try:
        from app.db.session import get_supabase_admin
        from app.services.storage_service import StorageService

        supabase = get_supabase_admin()
        result = (
            supabase.table("documents")
            .select("id, file_path, uploaded_by")
            .eq("id", document_id)
            .execute()
        )

        rows = result.data or []
        if not rows:
            raise HTTPException(status_code=404, detail="Document not found")

        doc = rows[0]

        if doc.get("uploaded_by") != user_id:
            raise HTTPException(
                status_code=403,
                detail="Not authorised to delete this document",
            )

        # Delete storage file — log warning but continue if it fails
        storage = StorageService()
        try:
            storage.delete_file(doc["file_path"])
        except Exception as e:
            logger.warning("Storage delete failed for %s (continuing): %s", document_id, e)

        # Delete DB record (cascades handle child rows)
        supabase.table("documents").delete().eq("id", document_id).execute()

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Delete failed for %s: %s", document_id, exc)
        raise HTTPException(status_code=500, detail=str(exc))
