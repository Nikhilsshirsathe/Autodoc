"""Validation result models for IPO generation readiness."""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field
from app.models.ipo.generation_result import SectionStatus


class MissingField(BaseModel):
    """Describes a field that is missing from the knowledge base."""
    field_key: str = Field(..., description="Dot-notation field key (e.g., 'company.cin')")
    description: str = Field(..., description="Human-readable field name")
    required: bool = Field(default=True, description="Whether this field is mandatory")
    suggested_document: str = Field(
        default="",
        description="Document type that typically contains this field"
    )


class SectionValidation(BaseModel):
    """Validation result for a single section."""
    section_id: str
    section_name: str
    display_order: int
    status: SectionStatus
    completeness_pct: float = Field(..., ge=0.0, le=100.0, description="Percentage of required fields present")
    required_fields_present: int = Field(default=0)
    required_fields_total: int = Field(default=0)
    missing_required: list[MissingField] = Field(default_factory=list)
    missing_optional: list[MissingField] = Field(default_factory=list)
    can_generate: bool = Field(default=False, description="True if section can be generated now")


class ValidationResult(BaseModel):
    """Overall IPO draft readiness validation result."""
    
    user_id: str
    
    # Summary
    overall_readiness_pct: float = Field(
        ..., ge=0.0, le=100.0,
        description="Overall IPO draft readiness percentage"
    )
    total_sections: int
    complete_sections: int = Field(default=0, description="Sections with all required data")
    partial_sections: int = Field(default=0, description="Sections with some data")
    missing_sections: int = Field(default=0, description="Sections with no data")
    
    # Per-section breakdown
    sections: list[SectionValidation] = Field(default_factory=list)
    
    # Global missing fields summary
    all_missing_required: list[MissingField] = Field(
        default_factory=list,
        description="All unique required fields missing across all sections"
    )
    
    # Document availability
    available_knowledge_fields: int = Field(
        default=0,
        description="Total knowledge fields available in the knowledge base"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "user-123",
                "overall_readiness_pct": 72.4,
                "total_sections": 29,
                "complete_sections": 14,
                "partial_sections": 11,
                "missing_sections": 4,
                "sections": [],
                "all_missing_required": [
                    {
                        "field_key": "financials.cash_flow",
                        "description": "Cash Flow Statement",
                        "required": True,
                        "suggested_document": "Audited Financial Statements"
                    }
                ],
                "available_knowledge_fields": 48
            }
        }
