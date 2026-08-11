"""
IPO Draft Generation API Endpoints.

Routes:
  GET  /api/v1/ipo/templates          — Return master template metadata (all 29 sections)
  POST /api/v1/ipo/validate            — Validate knowledge base completeness
  POST /api/v1/ipo/generate-section    — Generate a single section
  POST /api/v1/ipo/generate            — Generate all sections (complete IPO Draft)
  GET  /api/v1/ipo/download/markdown   — Download draft as Markdown
  GET  /api/v1/ipo/download/docx       — Download draft as DOCX
  GET  /api/v1/ipo/download/pdf        — Download draft as PDF
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.models.ipo.generation_result import GenerationResult, SectionStatus
from app.models.ipo.validation_result import ValidationResult
from app.services.ipo.template_loader import TemplateLoader
from app.services.ipo.validation_engine import ValidationEngine
from app.services.ipo.section_generator import SectionGenerator
from app.services.ipo.document_composer import DocumentComposer

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Request / Response schemas ────────────────────────────────────────────────

class ValidateRequest(BaseModel):
    user_id: str = Field(..., description="User ID to scope the knowledge base")
    project_id: Optional[str] = Field(default=None, description="Project ID to write validation_score back to")


class GenerateSectionRequest(BaseModel):
    section_id: str = Field(..., description="Section template ID (e.g., 'company-overview')")
    user_id: str = Field(..., description="User ID to scope the knowledge base")
    force: bool = Field(
        default=False,
        description="Generate with placeholders even if required fields are missing",
    )
    revision_notes: Optional[str] = Field(
        default="",
        description="Optional revision instructions for regeneration",
    )
    existing_content: Optional[str] = Field(
        default="",
        description="Previously generated content (for regeneration)",
    )


class GenerateAllRequest(BaseModel):
    user_id: str = Field(..., description="User ID to scope the knowledge base")
    force: bool = Field(
        default=False,
        description="Generate all sections, using placeholders for missing data",
    )
    section_ids: Optional[list[str]] = Field(
        default=None,
        description="Specific section IDs to generate. If None, generates all.",
    )


class GenerationSummaryResponse(BaseModel):
    total_sections: int
    generated_count: int
    missing_count: int
    error_count: int
    partial_count: int
    total_word_count: int
    average_confidence: float
    average_completeness_pct: float
    estimated_pages: int
    sections: list[GenerationResult]


class DownloadRequest(BaseModel):
    user_id: str
    sections: list[GenerationResult]
    company_name: Optional[str] = "[Company Name]"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get(
    "/templates",
    summary="Get all IPO Draft section template metadata",
    tags=["IPO Generation"],
)
async def get_templates() -> list[dict]:
    """
    Return metadata for all 29 DRHP section templates.
    Includes: id, section_name, display_order, description, estimated_pages,
              dependencies, sebi_reference.
    No prompt content is returned here.
    """
    try:
        loader = TemplateLoader()
        return loader.get_template_metadata()
    except Exception as exc:
        logger.error(f"Failed to load templates: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load templates: {str(exc)}",
        )


@router.post(
    "/validate",
    response_model=ValidationResult,
    summary="Validate knowledge base completeness for IPO Draft generation",
    tags=["IPO Generation"],
)
async def validate_knowledge_base(body: ValidateRequest) -> ValidationResult:
    """
    Validate all 29 IPO Draft sections against the current Knowledge Base.

    Returns:
    - `overall_readiness_pct`: 0–100 percentage
    - `sections`: Per-section status (COMPLETE / PARTIAL / MISSING)
    - `all_missing_required`: Deduplicated list of missing required fields
    - `complete_sections`, `partial_sections`, `missing_sections`: counts

    The frontend uses this to display IPO Readiness % and section status badges.
    """
    if not body.user_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="user_id is required",
        )
    try:
        engine = ValidationEngine(user_id=body.user_id)
        result = engine.validate_all_sections()

        # Write score back to the project if project_id was provided
        if body.project_id:
            try:
                from app.db.session import get_supabase_admin
                supabase = get_supabase_admin()
                supabase.table("projects").update({
                    "validation_score": int(result.overall_readiness_pct),
                }).eq("id", body.project_id).execute()
            except Exception as wb_exc:
                logger.warning("Failed to write validation_score to project %s: %s", body.project_id, wb_exc)

        return result
    except Exception as exc:
        logger.error(f"Validation failed for user {body.user_id}: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Validation failed: {str(exc)}",
        )


@router.post(
    "/generate-section",
    response_model=GenerationResult,
    summary="Generate a single DRHP section",
    tags=["IPO Generation"],
)
async def generate_section(body: GenerateSectionRequest) -> GenerationResult:
    """
    Generate (or regenerate) a single IPO Draft section using LLM + Knowledge Base.

    - Loads the section template from YAML
    - Validates required fields in the KB
    - Retrieves only the relevant knowledge for this section
    - Builds a structured prompt using the stored prompt template
    - Calls GPT to generate Markdown content
    - Returns GenerationResult with content, confidence, sources, missing_fields

    Each section is independently generatable. Changing one section does not
    require regenerating the entire document.
    """
    if not body.section_id or not body.user_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="section_id and user_id are required",
        )
    if not _openai_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenAI API key is not configured on the server",
        )
    try:
        generator = SectionGenerator(user_id=body.user_id)
        result = generator.generate_section(
            section_id=body.section_id,
            force=body.force,
            revision_notes=body.revision_notes or "",
            existing_content=body.existing_content or "",
        )
        return result
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error(
            f"Section generation failed for '{body.section_id}': {exc}", exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Section generation failed: {str(exc)}",
        )


@router.post(
    "/generate",
    response_model=GenerationSummaryResponse,
    summary="Generate complete IPO Draft (all sections)",
    tags=["IPO Generation"],
)
async def generate_full_draft(body: GenerateAllRequest) -> GenerationSummaryResponse:
    """
    Generate all 29 IPO Draft sections (or a specified subset).

    Sections with MISSING status are included as placeholder sections
    if force=True, otherwise they are returned as MISSING with field details.

    Sections are generated sequentially to respect dependency ordering.

    Returns a GenerationSummaryResponse with all section results and summary stats.
    """
    if not body.user_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="user_id is required",
        )
    if not _openai_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenAI API key is not configured on the server",
        )

    try:
        loader = TemplateLoader()
        all_templates = loader.load_all_templates()

        # Filter to specific sections if provided
        if body.section_ids:
            all_templates = [t for t in all_templates if t.id in body.section_ids]

        generator = SectionGenerator(user_id=body.user_id)
        results: list[GenerationResult] = []

        for template in all_templates:
            logger.info(f"Generating section: {template.id}")
            result = generator.generate_section(
                section_id=template.id,
                force=body.force,
            )
            results.append(result)

        # Build summary
        composer = DocumentComposer()
        summary = composer.get_generation_summary(results)

        return GenerationSummaryResponse(
            **summary,
            sections=results,
        )

    except Exception as exc:
        logger.error(f"Full draft generation failed: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Draft generation failed: {str(exc)}",
        )


@router.post(
    "/download/markdown",
    summary="Download generated draft as Markdown",
    tags=["IPO Generation"],
    response_class=Response,
)
async def download_markdown(body: DownloadRequest) -> Response:
    """
    Compose all provided section results into a single Markdown document
    and return it as a downloadable file.
    """
    try:
        composer = DocumentComposer()
        markdown = composer.compose_markdown(
            sections=body.sections,
            company_name=body.company_name or "[Company Name]",
        )
        filename = f"IPO_Draft_{body.company_name.replace(' ', '_')}.md"
        return Response(
            content=markdown.encode("utf-8"),
            media_type="text/markdown",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Type": "text/markdown; charset=utf-8",
            },
        )
    except Exception as exc:
        logger.error(f"Markdown download failed: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Download failed: {str(exc)}",
        )


@router.post(
    "/download/docx",
    summary="Download generated draft as DOCX",
    tags=["IPO Generation"],
    response_class=Response,
)
async def download_docx(body: DownloadRequest) -> Response:
    """
    Compose all provided section results into a DOCX file.
    Requires python-docx to be installed.
    """
    try:
        composer = DocumentComposer()
        docx_bytes = composer.compose_docx(
            sections=body.sections,
            company_name=body.company_name or "[Company Name]",
        )
        filename = f"IPO_Draft_{body.company_name.replace(' ', '_')}.docx"
        return Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
            },
        )
    except RuntimeError as exc:
        # python-docx not installed
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error(f"DOCX download failed: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"DOCX download failed: {str(exc)}",
        )


@router.post(
    "/download/pdf",
    summary="Download generated IPO Draft as PDF",
    tags=["IPO Generation"],
    response_class=Response,
)
async def download_pdf(body: DownloadRequest) -> Response:
    """
    Compose all provided section results into a PDF file using pypdfium2
    and return it as a downloadable file.
    """
    try:
        composer = DocumentComposer()
        pdf_bytes = composer.compose_pdf(
            sections=body.sections,
            company_name=body.company_name or "[Company Name]",
        )
        safe_name = (body.company_name or "IPO_Draft").replace(" ", "_")
        filename = f"IPO_Draft_{safe_name}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
            },
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error(f"PDF download failed: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PDF download failed: {str(exc)}",
        )


@router.post(
    "/download/pdf",
    summary="Download generated IPO Draft as PDF",
    tags=["IPO Generation"],
    response_class=Response,
)
async def download_pdf(body: DownloadRequest) -> Response:
    """
    Compose all provided section results into a PDF file using pypdfium2
    and return it as a downloadable file.
    """
    try:
        composer = DocumentComposer()
        pdf_bytes = composer.compose_pdf(
            sections=body.sections,
            company_name=body.company_name or "[Company Name]",
        )
        safe_name = (body.company_name or "IPO_Draft").replace(" ", "_")
        filename = f"IPO_Draft_{safe_name}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
            },
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error(f"PDF download failed: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PDF download failed: {str(exc)}",
        )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _openai_configured() -> bool:
    from app.core.config import settings
    return bool(settings.OPENAI_API_KEY)
