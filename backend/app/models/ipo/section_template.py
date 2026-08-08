"""Section template model for IPO draft generation."""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field


class KnowledgeMapping(BaseModel):
    """Knowledge base field mappings for a section."""
    category: str = Field(..., description="Knowledge category (e.g., 'company', 'financials')")
    fields: list[str] = Field(default_factory=list, description="Specific field names to retrieve")


class ValidationRule(BaseModel):
    """Validation rule for required/optional knowledge fields."""
    field: str = Field(..., description="Dot-notation knowledge field (e.g., 'company.company_name')")
    required: bool = Field(default=True, description="Whether this field is mandatory")
    description: str = Field(default="", description="Human-readable field description")


class SectionTemplate(BaseModel):
    """Template definition for an IPO DRHP section."""

    id: str = Field(..., description="Unique section identifier (e.g., 'company-overview')")
    section_name: str = Field(..., description="Display name of the section")
    display_order: int = Field(..., description="Order in the final document (1-based)")
    description: str = Field(default="", description="Purpose and content description of this section")

    # Knowledge mapping — what data is needed from the KB
    knowledge_mapping: list[KnowledgeMapping] = Field(
        default_factory=list,
        description="Knowledge base categories and fields required for this section",
    )

    # Validation rules derived from required/optional knowledge
    validation_rules: list[ValidationRule] = Field(
        default_factory=list,
        description="Required and optional field validations",
    )

    # Generation config
    prompt_template_path: str = Field(..., description="Relative path to the prompt template file")
    output_format: str = Field(default="markdown", description="Output format: markdown, html")

    # Metadata
    dependencies: list[str] = Field(
        default_factory=list,
        description="Section IDs that must be generated before this one",
    )
    estimated_pages: int = Field(default=1, description="Estimated page count for this section")
    sebi_reference: Optional[str] = Field(None, description="SEBI guideline reference if applicable")

    # Convenience helpers -------------------------------------------------

    @property
    def required_fields(self) -> list[str]:
        """Return only the required field keys."""
        return [r.field for r in self.validation_rules if r.required]

    @property
    def optional_fields(self) -> list[str]:
        """Return only the optional field keys."""
        return [r.field for r in self.validation_rules if not r.required]

    @property
    def all_knowledge_fields(self) -> list[str]:
        """Return all field keys from knowledge_mapping as dot-notation strings."""
        fields: list[str] = []
        for km in self.knowledge_mapping:
            for f in km.fields:
                fields.append(f"{km.category}.{f}")
        return fields

    class Config:
        json_schema_extra = {
            "example": {
                "id": "company-overview",
                "section_name": "Company Overview",
                "display_order": 6,
                "description": "Overview of the company's business, history, and operations",
                "knowledge_mapping": [
                    {"category": "company", "fields": ["company_name", "cin", "incorporation_date"]},
                    {"category": "business", "fields": ["business_overview", "products", "services"]},
                ],
                "validation_rules": [
                    {"field": "company.company_name", "required": True, "description": "Legal company name"},
                    {"field": "company.cin", "required": True, "description": "Corporate Identification Number"},
                ],
                "prompt_template_path": "prompts/company-overview.md",
                "output_format": "markdown",
                "dependencies": [],
                "estimated_pages": 2,
                "sebi_reference": "SEBI (ICDR) Regulations, 2018 - Schedule VIII",
            }
        }
