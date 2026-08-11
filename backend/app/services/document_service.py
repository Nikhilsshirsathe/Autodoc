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
        project_id: Optional[str] = None,
        company_id: Optional[str] = None,
        doc_type: str = "ipo_prospectus",
    ) -> dict:
        """
        1. Upload file to Supabase Storage.
        2. Insert a row in documents table (status='uploaded').
        3. Increment documents_uploaded counter on the linked project.
        4. Return the document row.
        """
        # Upload to storage
        storage_path = self.storage.upload_file(file_bytes, filename, mime_type, user_id)

        # Insert into documents table
        doc_row = {
            "id": str(uuid.uuid4()),
            "uploaded_by": user_id,
            "project_id": project_id,
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

        # Keep project counter in sync
        if project_id:
            self._update_project_doc_count(project_id)

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
        """Core extraction logic — uses batched Supabase inserts to avoid socket exhaustion."""
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

        # ── Batch-insert pages ────────────────────────────────────────────────
        page_rows = []
        for page in parse_result.pages:
            page_rows.append({
                "id": str(uuid.uuid4()),
                "document_id": document_id,
                "page_number": page.page_number,
                "raw_text": page.raw_text,
                "markdown_text": page.markdown_text,
                "ocr_used": page.ocr_used,
                "ocr_confidence": page.ocr_confidence,
                "has_tables": page.has_tables,
                "has_images": page.has_images,
            })

        page_id_map: dict[int, str] = {}
        if page_rows:
            inserted = self._batch_insert("document_pages", page_rows)
            for row in inserted:
                page_id_map[row["page_number"]] = row["id"]

        # ── Batch-insert tables ───────────────────────────────────────────────
        table_rows = []
        for page in parse_result.pages:
            for tbl in page.tables:
                table_rows.append({
                    "id": str(uuid.uuid4()),
                    "document_id": document_id,
                    "page_number": page.page_number,
                    "table_index": tbl["table_index"],
                    "headers": tbl.get("headers"),
                    "rows": tbl.get("rows"),
                    "raw_markdown": tbl.get("raw_markdown"),
                })
        if table_rows:
            self._batch_insert("extracted_tables", table_rows)

        # ── Batch-insert extracted fields ─────────────────────────────────────
        extracted_fields = extract_fields_from_pages(parse_result.pages)
        field_rows = [
            {
                "id": str(uuid.uuid4()),
                "document_id": document_id,
                "field_name": ef.field_name,
                "field_value": ef.field_value,
                "field_type": ef.field_type,
                "page_number": ef.page_number,
                "confidence": ef.confidence,
                "extraction_method": ef.extraction_method,
            }
            for ef in extracted_fields
        ]
        if field_rows:
            self._batch_insert("extracted_fields", field_rows)

        # ── Batch-insert chunks ───────────────────────────────────────────────
        chunks = chunk_document_pages(
            parse_result.pages,
            chunk_size=512,
            chunk_overlap=64,
        )
        chunk_rows = [
            {
                "id": str(uuid.uuid4()),
                "document_id": document_id,
                "page_id": page_id_map.get(chunk.page_number) if chunk.page_number else None,
                "chunk_index": chunk.chunk_index,
                "chunk_text": chunk.text,
                "token_count": chunk.token_count,
                "metadata": chunk.metadata or {},
            }
            for chunk in chunks
        ]
        if chunk_rows:
            self._batch_insert("document_chunks", chunk_rows)

        # ── Mark completed ────────────────────────────────────────────────────
        self._retry(lambda: self.supabase.table("documents").update({
            "status": "completed",
            "page_count": parse_result.page_count,
            "error_message": None,
        }).eq("id", document_id).execute())

        # ── Update project ai_confidence ──────────────────────────────────────
        project_id = doc.get("project_id")
        if project_id:
            self._update_project_ai_confidence(project_id)

        return {
            "document_id": document_id,
            "status": "completed",
            "page_count": parse_result.page_count,
            "fields_extracted": len(extracted_fields),
            "tables_extracted": len(table_rows),
            "chunks_created": len(chunk_rows),
        }

    # ── Batch insert helper ───────────────────────────────────────────────────

    def _batch_insert(self, table: str, rows: list[dict], batch_size: int = 50) -> list[dict]:
        """
        Insert rows in batches to avoid overwhelming the HTTP/2 connection.
        Each batch is retried up to 3 times on transient socket errors.
        Returns all inserted rows.
        """
        import time

        inserted: list[dict] = []
        for i in range(0, len(rows), batch_size):
            batch = rows[i : i + batch_size]
            result = self._retry(
                lambda b=batch: self.supabase.table(table).insert(b).execute()
            )
            if result and result.data:
                inserted.extend(result.data)
            # Small pause between batches to avoid socket saturation on Windows
            if i + batch_size < len(rows):
                time.sleep(0.05)
        return inserted

    def _retry(self, fn, attempts: int = 3, delay: float = 0.5):
        """
        Call fn() up to `attempts` times, retrying on transient network errors.
        """
        import time

        last_exc = None
        for attempt in range(attempts):
            try:
                return fn()
            except Exception as exc:
                last_exc = exc
                err = str(exc)
                # Retry only on transient socket / connection errors
                if any(k in err for k in ["10035", "ReadError", "ConnectError",
                                           "RemoteProtocolError", "ConnectionError"]):
                    logger.warning(
                        "Transient error on attempt %d/%d for DB call: %s",
                        attempt + 1, attempts, exc,
                    )
                    time.sleep(delay * (attempt + 1))
                else:
                    raise  # Non-retryable — fail immediately
        raise last_exc

    # ── Project counter helpers ───────────────────────────────────────────────

    def _update_project_doc_count(self, project_id: str) -> None:
        """Recount documents for a project and write it to projects.documents_uploaded."""
        try:
            res = (
                self.supabase.table("documents")
                .select("id", count="exact")
                .eq("project_id", project_id)
                .execute()
            )
            count = res.count or 0
            self.supabase.table("projects").update({
                "documents_uploaded": count,
            }).eq("id", project_id).execute()
        except Exception as exc:
            logger.warning("Failed to update documents_uploaded for project %s: %s", project_id, exc)

    def _update_project_ai_confidence(self, project_id: str) -> None:
        """Average confidence of all extracted fields for this project and write to projects.ai_confidence."""
        try:
            # Fetch all document IDs for this project
            doc_res = (
                self.supabase.table("documents")
                .select("id")
                .eq("project_id", project_id)
                .execute()
            )
            doc_ids = [d["id"] for d in (doc_res.data or [])]
            if not doc_ids:
                return

            # Fetch all extracted field confidence values across those documents
            fields_res = (
                self.supabase.table("extracted_fields")
                .select("confidence")
                .in_("document_id", doc_ids)
                .execute()
            )
            confidences = [
                f["confidence"] for f in (fields_res.data or [])
                if f.get("confidence") is not None
            ]
            if not confidences:
                return

            avg_confidence = round(sum(confidences) / len(confidences) * 100)
            self.supabase.table("projects").update({
                "ai_confidence": avg_confidence,
            }).eq("id", project_id).execute()
        except Exception as exc:
            logger.warning("Failed to update ai_confidence for project %s: %s", project_id, exc)

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
