"""
PromptBuilder: Build section-specific generation prompts.

Combines:
  1. Prompt template (from templates/ipo/prompts/*.md)
  2. Injected knowledge data (from KnowledgeMapper)
  3. Missing fields list (from ValidationEngine)

No hardcoded prompts — all content comes from template files.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from app.models.ipo.section_template import SectionTemplate
from app.models.ipo.validation_result import MissingField
from app.services.ipo.template_loader import TemplateLoader
from app.services.ipo.knowledge_mapper import KnowledgeMapper

logger = logging.getLogger(__name__)

# System-level preamble injected before every prompt
SYSTEM_PREAMBLE = """You are an expert IPO drafting specialist with deep knowledge of SEBI \
(Securities and Exchange Board of India) regulations for SME IPOs on NSE Emerge and BSE SME platforms.

CRITICAL RULES:
1. Use ONLY the structured data provided. Do NOT invent facts, figures, names, or dates.
2. If a required field is marked as missing, write [Information Required: <field description>] as a placeholder.
3. Follow SEBI (ICDR) Regulations, 2018 formatting conventions.
4. Use Indian numbering format (Lakhs, Crores) for financial figures.
5. Output in clean Markdown. Do NOT include the section heading — write only the body content.
6. Use formal, professional language consistent with SEBI regulatory filings.
7. This is an AI-generated FIRST DRAFT — append a note at the end:
   "---\\n*AI-Generated First Draft. All information must be verified by qualified \
Merchant Bankers and Legal Advisors before regulatory filing.*"
"""


class PromptBuilder:
    """Constructs the full prompt for a section generation call."""

    def __init__(self):
        self.template_loader = TemplateLoader()

    def build_prompt(
        self,
        template: SectionTemplate,
        knowledge: dict[str, Any],
        missing_fields: list[MissingField],
        knowledge_mapper: Optional[KnowledgeMapper] = None,
    ) -> tuple[str, str]:
        """
        Build the system and user prompt for section generation.

        Returns:
            tuple[str, str]: (system_prompt, user_prompt)
        """
        # 1. Load prompt template file
        try:
            prompt_template_content = self.template_loader.get_prompt_template_content(template.id)
        except FileNotFoundError:
            logger.warning(f"Prompt template not found for '{template.id}', using default")
            prompt_template_content = self._default_prompt_template(template)

        # 2. Format knowledge into readable text
        if knowledge_mapper:
            knowledge_text = knowledge_mapper.format_knowledge_for_prompt(knowledge)
        else:
            knowledge_text = self._format_knowledge_fallback(knowledge)

        # 3. Format missing fields
        missing_fields_text = self._format_missing_fields(missing_fields)

        # 4. Fill placeholders in prompt template
        user_prompt = (
            prompt_template_content
            .replace("{knowledge_data}", knowledge_text)
            .replace("{missing_fields}", missing_fields_text)
            .replace("{section_name}", template.section_name)
            .replace(
                "{sebi_reference}",
                template.sebi_reference or "SEBI (ICDR) Regulations, 2018",
            )
        )

        return SYSTEM_PREAMBLE, user_prompt

    def build_regeneration_prompt(
        self,
        template: SectionTemplate,
        knowledge: dict[str, Any],
        missing_fields: list[MissingField],
        existing_content: str,
        revision_notes: str = "",
        knowledge_mapper: Optional[KnowledgeMapper] = None,
    ) -> tuple[str, str]:
        """
        Build a prompt for regenerating an existing section with optional revision notes.
        """
        system_prompt, base_user_prompt = self.build_prompt(
            template, knowledge, missing_fields, knowledge_mapper
        )

        if existing_content or revision_notes:
            regeneration_context = "\n\n## Previous Version (for reference)\n"
            if existing_content:
                preview = existing_content[:500] + ("..." if len(existing_content) > 500 else "")
                regeneration_context += f"\n```\n{preview}\n```\n"
            if revision_notes:
                regeneration_context += (
                    f"\n## Revision Instructions\n{revision_notes}\n"
                    "Please incorporate these revisions in the new version.\n"
                )
            base_user_prompt = base_user_prompt + regeneration_context

        return system_prompt, base_user_prompt

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _default_prompt_template(self, template: SectionTemplate) -> str:
        """Fallback prompt template when the .md file is not found."""
        return f"""You are drafting the **{template.section_name}** section for a DRHP.

## Available Company Data
```
{{knowledge_data}}
```

## Missing Fields
```
{{missing_fields}}
```

## Instructions
Generate a complete, professional draft for the {template.section_name} section.
- Use formal SEBI-compliant language.
- Include [Information Required: <field>] for any missing data.
- Output in Markdown (no section heading).
- Estimated length: {template.estimated_pages} page(s).
{f'- SEBI Reference: {template.sebi_reference}' if template.sebi_reference else ''}
"""

    def _format_knowledge_fallback(self, knowledge: dict) -> str:
        """Simple fallback formatter when no KnowledgeMapper is provided."""
        lines: list[str] = []
        for category, fields in knowledge.items():
            if category == "_metadata":
                continue
            lines.append(f"\n[{category.upper()}]")
            if isinstance(fields, dict):
                for k, v in fields.items():
                    if isinstance(v, dict):
                        lines.append(f"  {k}: {v.get('value', 'N/A')}")
                    else:
                        lines.append(f"  {k}: {v}")
        return "\n".join(lines) or "No data available."

    def _format_missing_fields(self, missing_fields: list[MissingField]) -> str:
        """Format missing fields list for prompt injection."""
        if not missing_fields:
            return "None — all required fields are available."
        lines = ["The following required fields are missing from the knowledge base:"]
        for mf in missing_fields:
            req_tag = "[REQUIRED]" if mf.required else "[OPTIONAL]"
            lines.append(f"  - {req_tag} {mf.field_key}: {mf.description}")
            if mf.suggested_document:
                lines.append(f"    (Expected source: {mf.suggested_document})")
        return "\n".join(lines)
