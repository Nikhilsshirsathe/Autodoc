"""
ValidationEngine: Validate Knowledge Base completeness before section generation.

Determines per-section status:
  COMPLETE  — all required knowledge fields are present
  PARTIAL   — some required fields missing but section can still be partially generated
  MISSING   — critical required fields absent, section cannot be generated meaningfully
"""
from __future__ import annotations

import logging
from typing import Optional

from app.models.ipo.section_template import SectionTemplate
from app.models.ipo.generation_result import SectionStatus
from app.models.ipo.validation_result import (
    ValidationResult,
    SectionValidation,
    MissingField,
)
from app.services.ipo.template_loader import TemplateLoader
from app.services.ipo.knowledge_mapper import KnowledgeMapper

logger = logging.getLogger(__name__)


class ValidationEngine:
    """
    Validates the Knowledge Base against section template requirements.
    Returns a structured ValidationResult with per-section breakdown.
    """

    def __init__(self, user_id: str):
        """
        Args:
            user_id: The user whose Knowledge Base is being validated.
        """
        self.user_id = user_id
        self.template_loader = TemplateLoader()
        self.knowledge_mapper = KnowledgeMapper(user_id=user_id)

    # ------------------------------------------------------------------
    # Full validation
    # ------------------------------------------------------------------

    def validate_all_sections(self) -> ValidationResult:
        """
        Validate all 29 DRHP sections against the current Knowledge Base.

        Returns:
            ValidationResult: Complete validation report
        """
        templates = self.template_loader.load_all_templates()
        available_fields = self.knowledge_mapper.count_available_fields()

        section_validations: list[SectionValidation] = []
        all_missing_required: dict[str, MissingField] = {}  # deduplicated

        complete = partial = missing = 0

        for template in templates:
            sv = self._validate_section(template)
            section_validations.append(sv)

            if sv.status == SectionStatus.COMPLETE:
                complete += 1
            elif sv.status == SectionStatus.PARTIAL:
                partial += 1
            else:
                missing += 1

            # Deduplicate missing required fields
            for mf in sv.missing_required:
                if mf.field_key not in all_missing_required:
                    all_missing_required[mf.field_key] = mf

        total = len(templates)
        # Overall readiness = weighted by required fields present per section
        if total > 0:
            readiness = sum(sv.completeness_pct for sv in section_validations) / total
        else:
            readiness = 0.0

        return ValidationResult(
            user_id=self.user_id,
            overall_readiness_pct=round(readiness, 1),
            total_sections=total,
            complete_sections=complete,
            partial_sections=partial,
            missing_sections=missing,
            sections=section_validations,
            all_missing_required=list(all_missing_required.values()),
            available_knowledge_fields=available_fields,
        )

    # ------------------------------------------------------------------
    # Single section validation
    # ------------------------------------------------------------------

    def validate_section(self, section_id: str) -> SectionValidation:
        """
        Validate a single section by its ID.

        Args:
            section_id: Template section ID (e.g., "company-overview")

        Returns:
            SectionValidation
        """
        template = self.template_loader.load_template(section_id)
        return self._validate_section(template)

    def _validate_section(self, template: SectionTemplate) -> SectionValidation:
        """Core validation logic for a single template."""
        required_rules = [r for r in template.validation_rules if r.required]
        optional_rules = [r for r in template.validation_rules if not r.required]

        missing_required: list[MissingField] = []
        missing_optional: list[MissingField] = []

        # Check each required field
        for rule in required_rules:
            if not self.knowledge_mapper.check_field_exists(rule.field):
                missing_required.append(
                    MissingField(
                        field_key=rule.field,
                        description=rule.description or rule.field,
                        required=True,
                        suggested_document=self._suggest_document(rule.field),
                    )
                )

        # Check each optional field
        for rule in optional_rules:
            if not self.knowledge_mapper.check_field_exists(rule.field):
                missing_optional.append(
                    MissingField(
                        field_key=rule.field,
                        description=rule.description or rule.field,
                        required=False,
                        suggested_document=self._suggest_document(rule.field),
                    )
                )

        required_total = len(required_rules)
        required_present = required_total - len(missing_required)
        completeness_pct = (
            (required_present / required_total * 100.0) if required_total > 0 else 100.0
        )

        # Determine status
        if len(missing_required) == 0:
            status = SectionStatus.COMPLETE
            can_generate = True
        elif required_present > 0:
            status = SectionStatus.PARTIAL
            can_generate = True  # Can generate with partial data + placeholders
        else:
            status = SectionStatus.MISSING
            can_generate = False

        # Sections with no validation rules can always be generated
        if required_total == 0:
            status = SectionStatus.COMPLETE
            can_generate = True
            completeness_pct = 100.0

        return SectionValidation(
            section_id=template.id,
            section_name=template.section_name,
            display_order=template.display_order,
            status=status,
            completeness_pct=round(completeness_pct, 1),
            required_fields_present=required_present,
            required_fields_total=required_total,
            missing_required=missing_required,
            missing_optional=missing_optional,
            can_generate=can_generate,
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _suggest_document(self, field_key: str) -> str:
        """Suggest the document type most likely to contain this field."""
        field_key_lower = field_key.lower()
        if any(k in field_key_lower for k in ["financial", "revenue", "profit", "balance", "cash_flow", "eps", "roe"]):
            return "Audited Financial Statements / Annual Report"
        if any(k in field_key_lower for k in ["director", "kmp", "board", "chairman"]):
            return "Corporate Governance Report / Annual Report"
        if any(k in field_key_lower for k in ["promoter", "shareholding", "share_capital"]):
            return "Shareholding Pattern / Registrar Records"
        if any(k in field_key_lower for k in ["risk"]):
            return "Risk Management Policy / Annual Report"
        if any(k in field_key_lower for k in ["litigation", "legal", "court", "dispute"]):
            return "Legal Due Diligence Report / Compliance Report"
        if any(k in field_key_lower for k in ["company", "cin", "incorporation", "pan"]):
            return "Certificate of Incorporation / Memorandum of Association"
        if any(k in field_key_lower for k in ["issue", "price", "exchange"]):
            return "Issue Term Sheet / Board Resolution for IPO"
        if any(k in field_key_lower for k in ["dividend"]):
            return "Dividend Policy Document"
        if any(k in field_key_lower for k in ["related_party", "rpt"]):
            return "Related Party Transactions Report"
        if any(k in field_key_lower for k in ["property", "land", "plant"]):
            return "Asset Register / Valuation Report"
        if any(k in field_key_lower for k in ["approval", "license", "permit"]):
            return "Government Approvals / Licenses Register"
        return "Company Documents"
