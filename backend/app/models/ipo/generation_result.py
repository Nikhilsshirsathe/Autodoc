"""Generation result models for IPO draft sections."""
from __future__ import annotations
from enum import Enum
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class SectionStatus(str, Enum):
    """Status of a section's generation readiness."""
    COMPLETE = "complete"       # All required knowledge available, can generate
    PARTIAL = "partial"          # Some required knowledge missing
    MISSING = "missing"          # Critical knowledge missing
    GENERATED = "generated"      # Section has been generated
    ERROR = "error"              # Generation failed


class SourceReference(BaseModel):
    """Reference to source document for generated content."""
    document_id: str
    document_name: str
    page_number: Optional[int] = None
    field_name: Optional[str] = None
    chunk_ids: list[str] = Field(default_factory=list)


class GenerationResult(BaseModel):
    """Result of generating a single IPO section."""
    
    section_id: str = Field(..., description="Section template ID")
    section_name: str = Field(..., description="Section display name")
    status: SectionStatus = Field(..., description="Generation status")
    
    # Generated content
    content: str = Field(default="", description="Generated markdown/HTML content")
    word_count: int = Field(default=0, description="Word count of generated content")
    
    # Quality metrics
    confidence: float = Field(default=0.0, ge=0.0, le=1.0, description="Confidence score (0-1)")
    completeness: float = Field(default=0.0, ge=0.0, le=1.0, description="Data completeness score (0-1)")
    
    # Sources
    sources: list[SourceReference] = Field(
        default_factory=list,
        description="Source documents used in generation"
    )
    
    # Metadata
    generated_at: Optional[datetime] = None
    generation_time_seconds: float = Field(default=0.0, description="Time taken to generate")
    model_used: str = Field(default="", description="LLM model used for generation")
    
    # Warnings
    warnings: list[str] = Field(
        default_factory=list,
        description="Non-critical issues or missing optional data"
    )
    missing_fields: list[str] = Field(
        default_factory=list,
        description="Required fields that are missing"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "section_id": "company-overview",
                "section_name": "Company Overview",
                "status": "generated",
                "content": "# Company Overview\n\n[Generated content here]",
                "word_count": 450,
                "confidence": 0.92,
                "completeness": 0.95,
                "sources": [
                    {
                        "document_id": "doc-123",
                        "document_name": "Annual Report 2023.pdf",
                        "page_number": 5,
                        "chunk_ids": ["chunk-1", "chunk-2"]
                    }
                ],
                "generated_at": "2026-08-06T13:45:00Z",
                "generation_time_seconds": 8.5,
                "model_used": "gpt-4o-mini",
                "warnings": ["Optional field 'website' not found"],
                "missing_fields": []
            }
        }
