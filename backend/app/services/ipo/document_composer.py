"""
DocumentComposer: Merge generated sections into a complete IPO draft document.

Supports:
  - Markdown output (primary)
  - DOCX output (via python-docx if available, graceful fallback)
  - Extensible architecture for future PDF support

Sections are merged according to display_order from their templates.
"""
from __future__ import annotations

import io
import logging
from datetime import datetime, timezone
from typing import Optional

from app.models.ipo.generation_result import GenerationResult, SectionStatus
from app.services.ipo.template_loader import TemplateLoader

logger = logging.getLogger(__name__)

# DRHP document header template
DRHP_HEADER = """# DRAFT RED HERRING PROSPECTUS

> **IMPORTANT DISCLAIMER**
>
> This Draft Red Herring Prospectus ("DRHP") has been prepared using AUTODOC, an AI-powered
> document generation platform. This document is NOT a final regulatory filing.
> All information, figures, disclosures, and statements contained herein are AI-generated
> first drafts based on the documents uploaded to the system.
>
> **This draft MUST be reviewed, verified, and approved by qualified Merchant Bankers,
> Legal Advisors, and Company Secretaries before submission to SEBI or any stock exchange.**
>
> © {year} — AI-Generated First Draft | Powered by AUTODOC

---

*Generated on: {generated_at}*
*Sections Generated: {sections_generated} / {total_sections}*
*Overall Completeness: {completeness:.1f}%*

---

"""


class DocumentComposer:
    """
    Assembles individual section GenerationResults into a complete draft document.
    """

    def __init__(self):
        self.template_loader = TemplateLoader()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def compose_markdown(
        self,
        sections: list[GenerationResult],
        company_name: str = "[Company Name]",
    ) -> str:
        """
        Compose all generated sections into a single Markdown document.

        Args:
            sections: List of GenerationResult objects (any order; sorted internally)
            company_name: Company name for the document header

        Returns:
            str: Complete Markdown document
        """
        # Sort by display_order from templates
        ordered = self._sort_sections(sections)

        # Compute stats
        generated = [s for s in ordered if s.status == SectionStatus.GENERATED]
        completeness = (
            sum(s.completeness for s in generated) / len(generated) * 100
            if generated else 0.0
        )

        now = datetime.now(timezone.utc)
        header = DRHP_HEADER.format(
            year=now.year,
            generated_at=now.strftime("%d %B %Y, %H:%M UTC"),
            sections_generated=len(generated),
            total_sections=len(ordered),
            completeness=completeness,
        )

        # Build table of contents
        toc = self._build_toc(ordered)

        # Build section bodies
        body_parts: list[str] = []
        for result in ordered:
            body_parts.append(self._render_section_markdown(result))

        # Compile full document
        document = header + toc + "\n---\n\n" + "\n\n---\n\n".join(body_parts)
        return document

    def compose_docx(
        self,
        sections: list[GenerationResult],
        company_name: str = "[Company Name]",
    ) -> bytes:
        """
        Compose all generated sections into a DOCX file.

        Returns:
            bytes: DOCX file content

        Raises:
            RuntimeError: If python-docx is not available
        """
        try:
            from docx import Document
            from docx.shared import Pt, Inches, RGBColor
            from docx.enum.text import WD_ALIGN_PARAGRAPH
        except ImportError:
            raise RuntimeError(
                "python-docx is not installed. "
                "Add 'python-docx==1.1.2' to requirements.txt and reinstall."
            )

        ordered = self._sort_sections(sections)
        doc = Document()

        # Document title
        title = doc.add_heading(f"DRAFT RED HERRING PROSPECTUS", 0)
        title.alignment = WD_ALIGN_PARAGRAPH.CENTER

        # Subtitle
        sub = doc.add_paragraph(f"{company_name}")
        sub.alignment = WD_ALIGN_PARAGRAPH.CENTER

        # Disclaimer
        disclaimer = doc.add_paragraph(
            "IMPORTANT: This document is an AI-generated first draft. "
            "All information must be verified by qualified Merchant Bankers "
            "and Legal Advisors before regulatory filing to SEBI."
        )
        disclaimer.alignment = WD_ALIGN_PARAGRAPH.CENTER
        doc.add_page_break()

        # Table of Contents note
        doc.add_heading("Table of Contents", 1)
        for i, result in enumerate(ordered, 1):
            section_title = result.section_name
            status_label = self._status_label(result.status)
            doc.add_paragraph(f"{i}. {section_title}  [{status_label}]")

        doc.add_page_break()

        # Section content
        for result in ordered:
            doc.add_heading(result.section_name, 1)
            if result.status == SectionStatus.GENERATED and result.content:
                # Add paragraphs (strip markdown formatting for DOCX)
                clean_text = self._strip_markdown(result.content)
                for para_text in clean_text.split("\n\n"):
                    para_text = para_text.strip()
                    if para_text.startswith("## ") or para_text.startswith("### "):
                        heading_text = para_text.lstrip("#").strip()
                        doc.add_heading(heading_text, 2 if "## " in para_text else 3)
                    elif para_text:
                        doc.add_paragraph(para_text)
            elif result.status == SectionStatus.MISSING:
                doc.add_paragraph(
                    "[Section Not Generated — Required knowledge fields are missing. "
                    "Upload relevant documents and regenerate.]"
                )
            else:
                doc.add_paragraph("[Section Pending Generation]")

            # Add source references
            if result.sources:
                doc.add_paragraph(
                    f"Sources: {', '.join(s.document_name or s.document_id for s in result.sources[:3])}",
                ).italic = True

            doc.add_page_break()

        # Save to bytes
        buffer = io.BytesIO()
        doc.save(buffer)
        buffer.seek(0)
        return buffer.read()

    def get_generation_summary(self, sections: list[GenerationResult]) -> dict:
        """
        Return a summary of the current generation state.

        Returns:
            dict: Summary with counts, completeness, word count, etc.
        """
        total = len(sections)
        generated = [s for s in sections if s.status == SectionStatus.GENERATED]
        missing = [s for s in sections if s.status == SectionStatus.MISSING]
        error = [s for s in sections if s.status == SectionStatus.ERROR]
        partial = [s for s in sections if s.status == SectionStatus.PARTIAL]

        total_words = sum(s.word_count for s in generated)
        avg_confidence = (
            sum(s.confidence for s in generated) / len(generated)
            if generated else 0.0
        )
        avg_completeness = (
            sum(s.completeness for s in generated) / len(generated) * 100
            if generated else 0.0
        )

        return {
            "total_sections": total,
            "generated_count": len(generated),
            "missing_count": len(missing),
            "error_count": len(error),
            "partial_count": len(partial),
            "total_word_count": total_words,
            "average_confidence": round(avg_confidence, 2),
            "average_completeness_pct": round(avg_completeness, 1),
            "estimated_pages": total_words // 350 if total_words else 0,
        }

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _sort_sections(self, sections: list[GenerationResult]) -> list[GenerationResult]:
        """Sort sections by display_order from their templates."""
        order_map: dict[str, int] = {}
        try:
            templates = self.template_loader.load_all_templates()
            order_map = {t.id: t.display_order for t in templates}
        except Exception:
            pass
        return sorted(sections, key=lambda s: order_map.get(s.section_id, 999))

    def _build_toc(self, sections: list[GenerationResult]) -> str:
        """Build a Markdown table of contents."""
        lines = ["## Table of Contents\n"]
        for i, result in enumerate(sections, 1):
            status_icon = self._status_icon(result.status)
            anchor = result.section_name.lower().replace(" ", "-").replace("&", "").replace("  ", "-")
            lines.append(f"{i:02d}. {status_icon} [{result.section_name}](#{anchor})")
        return "\n".join(lines) + "\n"

    def _render_section_markdown(self, result: GenerationResult) -> str:
        """Render a single section as a Markdown block."""
        lines: list[str] = [f"## {result.section_name}"]

        # Section metadata strip
        status_badge = self._status_label(result.status)
        if result.status == SectionStatus.GENERATED:
            lines.append(
                f"*Status: {status_badge} | "
                f"Confidence: {result.confidence:.0%} | "
                f"Words: {result.word_count}*\n"
            )

        if result.status == SectionStatus.GENERATED and result.content:
            lines.append(result.content)
        elif result.status == SectionStatus.MISSING:
            lines.append(
                "> ⚠️ **Section Not Generated** — Required knowledge fields are missing.\n>\n"
                "> Missing fields:\n"
            )
            for field in result.missing_fields:
                lines.append(f"> - `{field}`")
            lines.append(
                "\n> Upload the relevant documents and regenerate this section."
            )
        elif result.status == SectionStatus.ERROR:
            lines.append(
                "> ❌ **Generation Error**\n>\n"
                + "\n".join(f"> {w}" for w in result.warnings)
            )
        else:
            lines.append("> ⏳ *Section pending generation.*")

        return "\n".join(lines)

    def _status_icon(self, status: SectionStatus) -> str:
        icons = {
            SectionStatus.GENERATED: "✅",
            SectionStatus.COMPLETE: "✅",
            SectionStatus.PARTIAL: "🟡",
            SectionStatus.MISSING: "❌",
            SectionStatus.ERROR: "⚠️",
        }
        return icons.get(status, "⏳")

    def _status_label(self, status: SectionStatus) -> str:
        labels = {
            SectionStatus.GENERATED: "Generated",
            SectionStatus.COMPLETE: "Complete",
            SectionStatus.PARTIAL: "Partial",
            SectionStatus.MISSING: "Missing Data",
            SectionStatus.ERROR: "Error",
        }
        return labels.get(status, "Pending")

    def _strip_markdown(self, text: str) -> str:
        """Remove basic markdown formatting for plain text (DOCX)."""
        import re
        text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)   # bold
        text = re.sub(r"\*(.*?)\*", r"\1", text)         # italic
        text = re.sub(r"`(.*?)`", r"\1", text)            # code
        text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)  # headings
        text = re.sub(r"^[-*+]\s+", "• ", text, flags=re.MULTILINE) # bullet lists
        text = re.sub(r"^>\s+", "", text, flags=re.MULTILINE)       # blockquotes
        return text
