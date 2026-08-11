"""
DocumentComposer: Merge generated sections into a complete IPO Draft document.

Supports:
  - Markdown output (primary)
  - DOCX output (via python-docx if available, graceful fallback)
  - PDF output (via pypdfium2)

Sections are merged according to display_order from their templates.
"""
from __future__ import annotations

import io
import logging
import re
from datetime import datetime, timezone
from typing import Optional

from app.models.ipo.generation_result import GenerationResult, SectionStatus
from app.services.ipo.template_loader import TemplateLoader

logger = logging.getLogger(__name__)

# IPO Draft document header template
IPO_DRAFT_HEADER = """# IPO DRAFT DOCUMENT

> **IMPORTANT DISCLAIMER**
>
> This IPO Draft has been prepared using AUTODOC, an AI-powered
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

# Keep legacy alias so any external code still using DRHP_HEADER doesn't break
DRHP_HEADER = IPO_DRAFT_HEADER


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
        header = IPO_DRAFT_HEADER.format(
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
        title = doc.add_heading(f"IPO DRAFT DOCUMENT", 0)
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

    def compose_pdf(
        self,
        sections: list[GenerationResult],
        company_name: str = "[Company Name]",
    ) -> bytes:
        """
        Compose all generated sections into a PDF file using pypdfium2.

        Uses pypdfium2's raw FPDF API to place standard-font text objects
        onto A4 pages with automatic line wrapping and pagination.

        Returns:
            bytes: PDF file content

        Raises:
            RuntimeError: If pypdfium2 is not available
        """
        try:
            import pypdfium2 as pdfium
            import pypdfium2.raw as pdfium_r
        except ImportError:
            raise RuntimeError(
                "pypdfium2 is not installed. "
                "Add 'pypdfium2' to requirements.txt and reinstall."
            )
        import ctypes

        ordered = self._sort_sections(sections)
        generated = [s for s in ordered if s.status == SectionStatus.GENERATED]
        completeness = (
            sum(s.completeness for s in generated) / len(generated) * 100
            if generated else 0.0
        )
        now = datetime.now(timezone.utc)
        generated_at = now.strftime("%d %B %Y, %H:%M UTC")

        # ── Layout constants (A4, points) ──────────────────────────────────
        PAGE_W, PAGE_H = 595, 842
        MARGIN_L, MARGIN_R, MARGIN_TOP, MARGIN_BOT = 60, 60, 60, 60
        CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R

        # Characters-per-line approximation at given size (Helvetica ≈ 0.5 * pt wide per char)
        def chars_per_line(pt: float) -> int:
            return max(1, int(CONTENT_W / (pt * 0.55)))

        def encode_utf16le(text: str):
            """Return a ctypes buffer of UTF-16LE text suitable for FPDFText_SetText."""
            data = text.encode("utf-16-le") + b"\x00\x00"
            buf_t = ctypes.c_uint16 * (len(data) // 2)
            return buf_t.from_buffer_copy(data)

        def wrap(text: str, pt: float) -> list[str]:
            """Word-wrap text to fit the content width at font size pt."""
            max_ch = chars_per_line(pt)
            words = text.split()
            lines: list[str] = []
            current = ""
            for word in words:
                if len(current) + (1 if current else 0) + len(word) <= max_ch:
                    current = f"{current} {word}".lstrip()
                else:
                    if current:
                        lines.append(current)
                    current = word
            if current:
                lines.append(current)
            return lines or [""]

        doc = pdfium.PdfDocument.new()
        current_page: list = [None]   # mutable cell so helpers can reference it
        current_y:    list = [0.0]

        def _new_page():
            p = doc.new_page(PAGE_W, PAGE_H)
            current_page[0] = p
            current_y[0] = PAGE_H - MARGIN_TOP

        def _add_line(text: str, pt: float,
                      bold: bool = False,
                      italic: bool = False,
                      color: tuple = (0, 0, 0),
                      x_offset: float = 0.0):
            """Place one line of text on the current page; auto-paginate."""
            if current_y[0] - pt < MARGIN_BOT:
                _new_page()

            font_name = (
                b"Helvetica-BoldOblique" if (bold and italic) else
                b"Helvetica-Bold"        if bold else
                b"Helvetica-Oblique"     if italic else
                b"Helvetica"
            )
            r, g, b = color
            raw_doc = doc.raw
            raw_page = current_page[0].raw

            tobj = pdfium_r.FPDFPageObj_NewTextObj(raw_doc, font_name, float(pt))
            pdfium_r.FPDFPageObj_SetFillColor(tobj, r, g, b, 255)
            pdfium_r.FPDFText_SetText(tobj, encode_utf16le(text[:200]))
            pdfium_r.FPDFPageObj_Transform(
                tobj, 1, 0, 0, 1,
                MARGIN_L + x_offset,
                current_y[0] - pt,
            )
            pdfium_r.FPDFPage_InsertObject(raw_page, tobj)
            pdfium_r.FPDFPage_GenerateContent(raw_page)
            current_y[0] -= pt + 3

        def _add_para(text: str, pt: float,
                      bold: bool = False, italic: bool = False,
                      color: tuple = (0, 0, 0),
                      x_offset: float = 0.0,
                      gap_after: float = 6.0):
            """Wrap and emit a paragraph."""
            for line in wrap(text, pt):
                _add_line(line, pt, bold=bold, italic=italic,
                          color=color, x_offset=x_offset)
            current_y[0] -= gap_after  # extra paragraph gap

        def _spacer(pts: float = 10.0):
            current_y[0] -= pts

        # ── Cover page ────────────────────────────────────────────────────
        _new_page()
        _spacer(40)
        _add_para("IPO DRAFT DOCUMENT", 20, bold=True)
        _add_para(company_name, 14, bold=True)
        _spacer(6)
        _add_para(f"Generated: {generated_at}", 9, italic=True, color=(100, 100, 100))
        _add_para(
            f"Sections: {len(generated)}/{len(ordered)}  |  "
            f"Completeness: {completeness:.1f}%",
            9, color=(100, 100, 100),
        )
        _spacer(20)
        _add_para("IMPORTANT DISCLAIMER", 9, bold=True, color=(180, 0, 0))
        for line in [
            "This IPO Draft is an AI-generated first draft produced by AUTODOC.",
            "It is NOT a final regulatory filing. All information must be reviewed,",
            "verified and approved by qualified Merchant Bankers, Legal Advisors,",
            "and Company Secretaries before submission to SEBI or any stock exchange.",
        ]:
            _add_line(line, 8, italic=True, color=(120, 60, 60))

        # ── Table of contents ──────────────────────────────────────────────
        _new_page()
        _add_para("TABLE OF CONTENTS", 13, bold=True)
        _spacer(4)
        for i, result in enumerate(ordered, 1):
            status_label = self._status_label(result.status)
            _add_line(
                f"{i:02d}.  {result.section_name}  [{status_label}]",
                9,
            )

        # ── Section pages ──────────────────────────────────────────────────
        for result in ordered:
            _new_page()
            _add_para(result.section_name.upper(), 13, bold=True)
            _spacer(4)

            if result.status == SectionStatus.GENERATED and result.content:
                clean = self._strip_markdown(result.content)
                for para in clean.split("\n\n"):
                    para = para.strip()
                    if not para:
                        continue
                    is_heading = para.isupper() and len(para) < 80
                    _add_para(para, 10 if is_heading else 9, bold=is_heading)
            elif result.status == SectionStatus.MISSING:
                _add_para(
                    "[Section Not Generated — Required knowledge fields are missing. "
                    "Upload relevant documents and regenerate.]",
                    9, italic=True, color=(160, 80, 0),
                )
            else:
                _add_para("[Section Pending Generation]",
                          9, italic=True, color=(120, 120, 120))

            # Source footer at bottom of first section page
            if result.sources:
                src_names = ", ".join(
                    s.document_name or s.document_id for s in result.sources[:3]
                )
                saved_y = current_y[0]
                current_y[0] = MARGIN_BOT + 10
                _add_line(
                    f"Sources: {src_names[:120]}",
                    7, italic=True, color=(120, 120, 120),
                )
                current_y[0] = min(saved_y, current_y[0])

        # Save to bytes
        buf = io.BytesIO()
        doc.save(buf)
        buf.seek(0)
        return buf.read()

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
