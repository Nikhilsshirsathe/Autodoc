"""
Document service — handles upload, DB persistence, and extraction pipeline.
"""
from __future__ import annotations

import asyncio
import logging
import sys
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.core.config import settings
from app.core.exceptions import StorageError, PipelineError
from app.db.session import get_supabase_admin
from app.services.storage_service import StorageService

logger = logging.getLogger(__name__)

# Add IPOAI root to path so ai/ package is importable from backend
_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)


class DocumentService:
    """Orchestrates document upload and extraction pipeline."""

    def __init__(self):
        self.storage = StorageService()
        self.supabase = get_supabase_admin()

    # ── Upload ────────────────────────────────────────────────────────────────

    def upload_document(
        self,
        file_bytes: bytes,
        filename: str,
        mime_type: str,
        user_id: str,
        company_id: Optional[str] = None,
        doc_type: str = "ipo_prospectus",
    ) -> dict:
        """
        1. Upload file to Supabase Storage.
        2. Insert a row in documents table (status='uploaded').
        3. Return the document row.
        """
        # Upload to storage
        storage_path = self.storage.upload_file(file_bytes, filename, mime_type, user_id)

        # Insert into documents table
        doc_row = {
            "id": str(uuid.uuid4()),
            "uploaded_by": user_id,
            "company_id": company_id,
            "filename": os.path.basename(storage_path),
            "original_name": filename,
            "file_path": storage_path,
            "storage_bucket": settings.STORAGE_BUCKET,
            "file_size": len(file_bytes),
            "mime_type": mime_type,
            "doc_type": doc_type,
            "status": "uploaded",
        }

        result = self.supabase.table("documents").insert(doc_row).execute()
        if not result.data:
            raise PipelineError("Failed to insert document record")
        return result.data[0]

    # ── Extraction pipeline ───────────────────────────────────────────────────

    def run_extraction_pipeline(self, document_id: str) -> dict:
        """
        Full pipeline:
          1. Set status → 'processing'
          2. Download file from storage
          3. Parse with Docling + OCR
          4. Store pages, chunks, extracted fields, tables
          5. Set status → 'completed'
        """
        # Fetch document row
        doc_result = (
            self.supabase.table("documents")
            .select("*")
            .eq("id", document_id)
            .single()
            .execute()
        )
        if not doc_result.data:
            raise PipelineError(f"Document {document_id} not found")

        doc = doc_result.data
        self._set_status(document_id, "processing")

        try:
            file_bytes = self.storage.download_file(doc["file_path"])
            return self._process_document(document_id, doc, file_bytes)
        except Exception as exc:
            logger.error("Pipeline failed for %s: %s", document_id, exc, exc_info=True)
            self._set_status(document_id, "failed", error_message=str(exc))
            raise PipelineError(str(exc)) from exc

    def _process_document(self, document_id: str, doc: dict, file_bytes: bytes) -> dict:
        """Core extraction logic."""
        # Import pipeline
        from ai.document_pipeline.parser import parse_document
        from ai.document_pipeline.extractor import extract_fields_from_pages
        from ai.document_pipeline.chunker import chunk_document_pages

        # Parse
        parse_result = parse_document(
            file_bytes=file_bytes,
            filename=doc["original_name"],
            mime_type=doc["mime_type"] or "application/pdf",
            enable_ocr=settings.ENABLE_OCR,
            ocr_language=settings.OCR_LANGUAGE,
            artifacts_path=settings.DOCLING_ARTIFACTS_PATH,
        )

        # Store pages
        page_id_map: dict[int, str] = {}
        for page in parse_result.pages:
            page_row = {
                "id": str(uuid.uuid4()),
                "document_id": document_id,
                "page_number": page.page_number,
                "raw_text": page.raw_text,
                "markdown_text": page.markdown_text,
                "ocr_used": page.ocr_used,
                "ocr_confidence": page.ocr_confidence,
                "has_tables": page.has_tables,
                "has_images": page.has_images,
            }
            res = self.supabase.table("document_pages").insert(page_row).execute()
            if res.data:
                page_id_map[page.page_number] = res.data[0]["id"]

        # Store extracted tables
        tables_stored = 0
        for page in parse_result.pages:
            for tbl in page.tables:
                tbl_row = {
                    "id": str(uuid.uuid4()),
                    "document_id": document_id,
                    "page_number": page.page_number,
                    "table_index": tbl["table_index"],
                    "headers": tbl.get("headers"),
                    "rows": tbl.get("rows"),
                    "raw_markdown": tbl.get("raw_markdown"),
                }
                self.supabase.table("extracted_tables").insert(tbl_row).execute()
                tables_stored += 1

        # Extract structured fields
        extracted_fields = extract_fields_from_pages(parse_result.pages)
        for ef in extracted_fields:
            field_row = {
                "id": str(uuid.uuid4()),
                "document_id": document_id,
                "field_name": ef.field_name,
                "field_value": ef.field_value,
                "field_type": ef.field_type,
                "page_number": ef.page_number,
                "confidence": ef.confidence,
                "extraction_method": ef.extraction_method,
            }
            self.supabase.table("extracted_fields").insert(field_row).execute()

        # Chunk text for RAG
        chunks = chunk_document_pages(
            parse_result.pages,
            chunk_size=512,
            chunk_overlap=64,
        )
        for chunk in chunks:
            page_id = page_id_map.get(chunk.page_number) if chunk.page_number else None
            chunk_row = {
                "id": str(uuid.uuid4()),
                "document_id": document_id,
                "page_id": page_id,
                "chunk_index": chunk.chunk_index,
                "chunk_text": chunk.text,
                "token_count": chunk.token_count,
                # embedding: set to None now; add OpenAI embeddings later
                "metadata": chunk.metadata or {},
            }
            self.supabase.table("document_chunks").insert(chunk_row).execute()

        # Update document status
        self.supabase.table("documents").update({
            "status": "completed",
            "page_count": parse_result.page_count,
            "error_message": None,
        }).eq("id", document_id).execute()

        return {
            "document_id": document_id,
            "status": "completed",
            "page_count": parse_result.page_count,
            "fields_extracted": len(extracted_fields),
            "tables_extracted": tables_stored,
            "chunks_created": len(chunks),
        }

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _set_status(self, document_id: str, status: str, error_message: str = None):
        update = {"status": status}
        if error_message:
            update["error_message"] = error_message
        self.supabase.table("documents").update(update).eq("id", document_id).execute()

    def get_document(self, document_id: str, user_id: str) -> Optional[dict]:
        """Fetch a document row (respecting ownership)."""
        res = (
            self.supabase.table("documents")
            .select("*")
            .eq("id", document_id)
            .single()
            .execute()
        )
        return res.data if res.data else None

    def list_documents(self, user_id: str, limit: int = 50) -> list[dict]:
        """List all documents uploaded by the user."""
        res = (
            self.supabase.table("documents")
            .select("*")
            .eq("uploaded_by", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return res.data or []

    def get_pipeline_status(self, document_id: str) -> dict:
        """Return document status + counts of extracted data."""
        doc_res = (
            self.supabase.table("documents")
            .select("*")
            .eq("id", document_id)
            .single()
            .execute()
        )
        if not doc_res.data:
            return {"document_id": document_id, "status": "not_found"}

        doc = doc_res.data
        fields_count = (
            self.supabase.table("extracted_fields")
            .select("id", count="exact")
            .eq("document_id", document_id)
            .execute()
            .count or 0
        )
        tables_count = (
            self.supabase.table("extracted_tables")
            .select("id", count="exact")
            .eq("document_id", document_id)
            .execute()
            .count or 0
        )
        chunks_count = (
            self.supabase.table("document_chunks")
            .select("id", count="exact")
            .eq("document_id", document_id)
            .execute()
            .count or 0
        )

        return {
            "document_id": document_id,
            "status": doc["status"],
            "page_count": doc.get("page_count"),
            "error_message": doc.get("error_message"),
            "extracted_fields_count": fields_count,
            "extracted_tables_count": tables_count,
            "chunks_count": chunks_count,
        }

    def get_extracted_fields(self, document_id: str) -> list[dict]:
        res = (
            self.supabase.table("extracted_fields")
            .select("*")
            .eq("document_id", document_id)
            .order("field_name")
            .execute()
        )
        return res.data or []

    def get_extracted_tables(self, document_id: str) -> list[dict]:
        res = (
            self.supabase.table("extracted_tables")
            .select("*")
            .eq("document_id", document_id)
            .order("page_number", "table_index")
            .execute()
        )
        return res.data or []
