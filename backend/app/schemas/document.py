"""
Pydantic schemas for Document-related requests and responses.
We use supabase-py directly (no SQLAlchemy ORM), so these schemas
represent the Supabase table rows as Python dataclasses.
"""
from __future__ import annotations
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field
import uuid


# ── Upload ───────────────────────────────────────────────────────────────────

class DocumentUploadResponse(BaseModel):
    id: str
    filename: str
    original_name: str
    file_path: str
    file_size: int
    mime_type: str
    status: str
    created_at: datetime


# ── Document row ─────────────────────────────────────────────────────────────

class DocumentOut(BaseModel):
    id: str
    company_id: Optional[str] = None
    uploaded_by: Optional[str] = None
    filename: str
    original_name: str
    file_path: str
    storage_bucket: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    doc_type: Optional[str] = "ipo_prospectus"
    status: str
    error_message: Optional[str] = None
    page_count: Optional[int] = None
    created_at: datetime
    updated_at: datetime


# ── Extracted field ───────────────────────────────────────────────────────────

class ExtractedFieldOut(BaseModel):
    id: str
    document_id: str
    field_name: str
    field_value: Optional[str] = None
    field_type: str
    page_number: Optional[int] = None
    confidence: Optional[float] = None
    extraction_method: str


# ── Extracted table ───────────────────────────────────────────────────────────

class ExtractedTableOut(BaseModel):
    id: str
    document_id: str
    page_number: Optional[int] = None
    table_index: Optional[int] = None
    caption: Optional[str] = None
    headers: Optional[list[str]] = None
    rows: Optional[list[list[Any]]] = None
    raw_markdown: Optional[str] = None


# ── Pipeline status ───────────────────────────────────────────────────────────

class PipelineStatusOut(BaseModel):
    document_id: str
    status: str
    page_count: Optional[int] = None
    error_message: Optional[str] = None
    extracted_fields_count: int = 0
    extracted_tables_count: int = 0
    chunks_count: int = 0
