"""
SectionGenerator: Generate individual DRHP sections using LLM.

Each section is independently generatable.
Input:  section_id + user_id
Output: GenerationResult with markdown content

Key design decisions:
- Never hallucinate: missing required fields become [Information Required: ...] placeholders
- Retry with tenacity for transient OpenAI errors
- Each call goes through: TemplateLoader → KnowledgeMapper → ValidationEngine → PromptBuilder → OpenAI
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Optional

from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.core.config import settings
from app.models.ipo.generation_result import GenerationResult, SectionStatus, SourceReference
from app.models.ipo.validation_result import MissingField
from app.services.ipo.template_loader import TemplateLoader
from app.services.ipo.knowledge_mapper import KnowledgeMapper
from app.services.ipo.validation_engine import ValidationEngine
from app.services.ipo.prompt_builder import PromptBuilder

logger = logging.getLogger(__name__)


class SectionGenerator:
    """
    Generates a single DRHP section from the Knowledge Base via LLM.
    """

    def __init__(self, user_id: str):
        """
        Args:
            user_id: ID of the user whose Knowledge Base to use.
        """
        self.user_id = user_id
        self.template_loader = TemplateLoader()
        self.knowledge_mapper = KnowledgeMapper(user_id=user_id)
        self.validation_engine = ValidationEngine(user_id=user_id)
        self.prompt_builder = PromptBuilder()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def generate_section(
        self,
        section_id: str,
        force: bool = False,
        revision_notes: str = "",
        existing_content: str = "",
    ) -> GenerationResult:
        """
        Generate a single DRHP section.

        Args:
            section_id: Template section ID (e.g., "company-overview")
            force: If True, generate even when status is MISSING
            revision_notes: Optional revision instructions for regeneration
            existing_content: Previously generated content (for regeneration)

        Returns:
            GenerationResult
        """
        start_time = time.time()

        # 1. Load template
        try:
            template = self.template_loader.load_template(section_id)
        except FileNotFoundError:
            return GenerationResult(
                section_id=section_id,
                section_name=section_id,
                status=SectionStatus.ERROR,
                warnings=[f"Template '{section_id}' not found"],
            )

        # 2. Validate section readiness
        section_validation = self.validation_engine.validate_section(section_id)
        missing_required = section_validation.missing_required
        missing_optional = section_validation.missing_optional

        # 3. Check if we can generate
        if section_validation.status == SectionStatus.MISSING and not force:
            return GenerationResult(
                section_id=section_id,
                section_name=template.section_name,
                status=SectionStatus.MISSING,
                completeness=section_validation.completeness_pct / 100.0,
                missing_fields=[mf.field_key for mf in missing_required],
                warnings=[
                    f"Cannot generate: {len(missing_required)} required field(s) missing. "
                    "Upload relevant documents or use force=True to generate with placeholders."
                ],
            )

        # 4. Fetch knowledge for this section
        knowledge = self.knowledge_mapper.get_knowledge_for_section(template)

        # 5. Build prompt
        if existing_content or revision_notes:
            system_prompt, user_prompt = self.prompt_builder.build_regeneration_prompt(
                template=template,
                knowledge=knowledge,
                missing_fields=missing_required + missing_optional,
                existing_content=existing_content,
                revision_notes=revision_notes,
                knowledge_mapper=self.knowledge_mapper,
            )
        else:
            system_prompt, user_prompt = self.prompt_builder.build_prompt(
                template=template,
                knowledge=knowledge,
                missing_fields=missing_required + missing_optional,
                knowledge_mapper=self.knowledge_mapper,
            )

        # 6. Call LLM
        try:
            content = self._call_llm(system_prompt, user_prompt, template.estimated_pages)
        except Exception as exc:
            logger.error(f"LLM call failed for section '{section_id}': {exc}", exc_info=True)
            return GenerationResult(
                section_id=section_id,
                section_name=template.section_name,
                status=SectionStatus.ERROR,
                completeness=section_validation.completeness_pct / 100.0,
                missing_fields=[mf.field_key for mf in missing_required],
                warnings=[f"LLM generation failed: {str(exc)}"],
            )

        # 7. Build source references from knowledge metadata
        sources = self._build_sources(knowledge)

        # 8. Calculate metrics
        elapsed = time.time() - start_time
        word_count = len(content.split())
        completeness = section_validation.completeness_pct / 100.0
        confidence = self._estimate_confidence(
            completeness=completeness,
            missing_required_count=len(missing_required),
            word_count=word_count,
        )

        warnings: list[str] = [
            f"Optional field missing: {mf.description}" for mf in missing_optional
        ]

        return GenerationResult(
            section_id=section_id,
            section_name=template.section_name,
            status=SectionStatus.GENERATED,
            content=content,
            word_count=word_count,
            confidence=round(confidence, 2),
            completeness=round(completeness, 2),
            sources=sources,
            generated_at=datetime.now(timezone.utc),
            generation_time_seconds=round(elapsed, 2),
            model_used=settings.OPENAI_CHAT_MODEL,
            warnings=warnings,
            missing_fields=[mf.field_key for mf in missing_required],
        )

    # ------------------------------------------------------------------
    # LLM call with retry
    # ------------------------------------------------------------------

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(Exception),
        reraise=True,
    )
    def _call_llm(self, system_prompt: str, user_prompt: str, estimated_pages: int) -> str:
        """
        Call OpenAI chat completion with retry logic.

        Args:
            system_prompt: System-level instructions
            user_prompt: User prompt with knowledge data
            estimated_pages: Used to estimate max_tokens

        Returns:
            str: Generated markdown content
        """
        from openai import OpenAI

        if not settings.OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY is not configured")

        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        # Estimate tokens: ~400 words/page, ~1.3 tokens/word → ~520 tokens/page
        max_tokens = min(max(estimated_pages * 600, 800), 4000)

        response = client.chat.completions.create(
            model=settings.OPENAI_CHAT_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,      # Low temperature for consistent, factual output
            max_tokens=max_tokens,
        )

        content = response.choices[0].message.content or ""
        if not content.strip():
            raise ValueError("LLM returned empty response")
        return content

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _build_sources(self, knowledge: dict) -> list[SourceReference]:
        """Extract source document references from knowledge data."""
        doc_map: dict[str, SourceReference] = {}
        for category, fields in knowledge.items():
            if category == "_metadata":
                continue
            if isinstance(fields, dict):
                for field_name, field_data in fields.items():
                    if isinstance(field_data, dict):
                        doc_id = field_data.get("source_document_id", "")
                        if doc_id and doc_id not in doc_map:
                            doc_map[doc_id] = SourceReference(
                                document_id=doc_id,
                                document_name=None,
                                page_number=field_data.get("page_number"),
                                field_name=f"{category}.{field_name}",
                                chunk_ids=[],
                            )
        return list(doc_map.values())

    def _estimate_confidence(
        self,
        completeness: float,
        missing_required_count: int,
        word_count: int,
    ) -> float:
        """
        Heuristic confidence score for the generated section.

        Factors:
        - Data completeness (0.6 weight)
        - No missing required fields (0.3 weight)
        - Reasonable word count (0.1 weight)
        """
        completeness_score = completeness * 0.6
        missing_penalty = max(0.0, 0.3 - (missing_required_count * 0.05))
        length_score = min(word_count / 500, 1.0) * 0.1
        return min(completeness_score + missing_penalty + length_score, 0.98)
