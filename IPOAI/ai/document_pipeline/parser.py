"""
Document parser using IBM Docling with Tesseract OCR fallback.

Docling supports: PDF, DOCX, PPTX, HTML, images (PNG, JPEG, TIFF).
For scanned/image-only PDFs, Docling can use its built-in OCR pipeline.
We additionally support direct image OCR via pytesseract as a fallback.
"""
from __future__ import annotations

import io
import logging
import os
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class PageResult:
    page_number: int
    raw_text: str
    markdown_text: str
    ocr_used: bool = False
    ocr_confidence: Optional[float] = None
    has_tables: bool = False
    has_images: bool = False
    tables: list[dict] = field(default_factory=list)  # list of table dicts


@dataclass
class ParseResult:
    pages: list[PageResult]
    full_text: str
    full_markdown: str
    page_count: int
    source_file: str
    mime_type: str
    used_ocr: bool = False


def _try_import_docling():
    """Lazy import docling to avoid startup errors if not installed."""
    try:
        from docling.document_converter import DocumentConverter
        from docling.datamodel.pipeline_options import PdfPipelineOptions
        from docling.datamodel.base_models import InputFormat
        return DocumentConverter, PdfPipelineOptions, InputFormat
    except ImportError:
        return None, None, None


def _try_import_tesseract():
    """Lazy import pytesseract."""
    try:
        import pytesseract
        from PIL import Image
        return pytesseract, Image
    except ImportError:
        return None, None


def _extract_tables_from_docling_page(page) -> list[dict]:
    """Extract table data from a Docling page object."""
    tables = []
    try:
        if hasattr(page, "tables"):
            for i, tbl in enumerate(page.tables):
                headers = []
                rows = []
                raw_md = ""
                try:
                    raw_md = tbl.export_to_markdown() if hasattr(tbl, "export_to_markdown") else ""
                    if hasattr(tbl, "data") and hasattr(tbl.data, "grid"):
                        grid = tbl.data.grid
                        if grid:
                            headers = [c.text if hasattr(c, "text") else str(c)
                                       for c in grid[0]]
                            rows = [[c.text if hasattr(c, "text") else str(c)
                                     for c in row]
                                    for row in grid[1:]]
                except Exception as e:
                    logger.warning("Table extraction error: %s", e)
                tables.append({
                    "table_index": i,
                    "headers": headers,
                    "rows": rows,
                    "raw_markdown": raw_md,
                })
    except Exception as e:
        logger.warning("Could not extract tables: %s", e)
    return tables


def parse_document(
    file_bytes: bytes,
    filename: str,
    mime_type: str,
    enable_ocr: bool = True,
    ocr_language: str = "eng",
    artifacts_path: str = "",
) -> ParseResult:
    """
    Parse a document using Docling, falling back to pytesseract for images.

    Returns a ParseResult with per-page text, markdown, and tables.
    """
    DocumentConverter, PdfPipelineOptions, InputFormat = _try_import_docling()

    # ── Image-only path (direct Tesseract OCR) ────────────────────────────────
    if mime_type in ("image/png", "image/jpeg", "image/tiff", "image/jpg"):
        return _parse_image_ocr(file_bytes, filename, mime_type, ocr_language)

    # ── Docling path (PDF, DOCX, etc.) ────────────────────────────────────────
    if DocumentConverter is None:
        logger.warning("Docling not available — falling back to basic text extraction")
        return _fallback_pdf_extraction(file_bytes, filename, mime_type, ocr_language)

    try:
        return _parse_with_docling(
            file_bytes, filename, mime_type,
            DocumentConverter, PdfPipelineOptions,
            enable_ocr, ocr_language, artifacts_path,
        )
    except Exception as exc:
        logger.error("Docling parsing failed: %s — trying fallback", exc)
        return _fallback_pdf_extraction(file_bytes, filename, mime_type, ocr_language)


def _parse_with_docling(
    file_bytes: bytes,
    filename: str,
    mime_type: str,
    DocumentConverter,
    PdfPipelineOptions,
    enable_ocr: bool,
    ocr_language: str,
    artifacts_path: str,
) -> ParseResult:
    """Parse using IBM Docling."""
    with tempfile.NamedTemporaryFile(
        suffix=Path(filename).suffix or ".pdf",
        delete=False,
    ) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        # Configure pipeline
        pipeline_opts = PdfPipelineOptions()
        pipeline_opts.do_ocr = enable_ocr
        pipeline_opts.do_table_structure = True
        if artifacts_path:
            pipeline_opts.artifacts_path = artifacts_path

        converter = DocumentConverter()
        result = converter.convert(tmp_path)
        doc = result.document

        pages: list[PageResult] = []
        full_md_parts: list[str] = []

        # Iterate pages
        page_objects = list(doc.pages) if hasattr(doc, "pages") else []

        if not page_objects:
            # Single-page fallback
            md_text = doc.export_to_markdown() if hasattr(doc, "export_to_markdown") else ""
            pages.append(PageResult(
                page_number=1,
                raw_text=md_text,
                markdown_text=md_text,
                has_tables=False,
                has_images=False,
            ))
            full_md_parts.append(md_text)
        else:
            for page in page_objects:
                page_num = getattr(page, "page_no", len(pages) + 1)
                # Get page-level markdown
                try:
                    page_md = page.export_to_markdown() if hasattr(page, "export_to_markdown") else ""
                except Exception:
                    page_md = ""

                tables = _extract_tables_from_docling_page(page)
                pages.append(PageResult(
                    page_number=page_num,
                    raw_text=page_md,
                    markdown_text=page_md,
                    ocr_used=enable_ocr,
                    has_tables=len(tables) > 0,
                    tables=tables,
                ))
                full_md_parts.append(page_md)

        full_md = "\n\n---\n\n".join(full_md_parts)
        return ParseResult(
            pages=pages,
            full_text=full_md,
            full_markdown=full_md,
            page_count=len(pages),
            source_file=filename,
            mime_type=mime_type,
            used_ocr=enable_ocr,
        )
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def _parse_image_ocr(
    file_bytes: bytes,
    filename: str,
    mime_type: str,
    language: str,
) -> ParseResult:
    """Extract text from a single image file using Tesseract."""
    pytesseract, Image = _try_import_tesseract()
    if pytesseract is None:
        return ParseResult(
            pages=[PageResult(page_number=1, raw_text="", markdown_text="",
                              ocr_used=True, ocr_confidence=0.0)],
            full_text="",
            full_markdown="",
            page_count=1,
            source_file=filename,
            mime_type=mime_type,
            used_ocr=True,
        )

    image = Image.open(io.BytesIO(file_bytes))
    text = pytesseract.image_to_string(image, lang=language)
    data = pytesseract.image_to_data(image, lang=language,
                                     output_type=pytesseract.Output.DICT)
    confidences = [int(c) for c in data["conf"] if str(c).strip().lstrip("-").isdigit() and int(c) >= 0]
    avg_conf = sum(confidences) / len(confidences) if confidences else 0.0

    page = PageResult(
        page_number=1,
        raw_text=text,
        markdown_text=text,
        ocr_used=True,
        ocr_confidence=avg_conf / 100.0,
    )
    return ParseResult(
        pages=[page],
        full_text=text,
        full_markdown=text,
        page_count=1,
        source_file=filename,
        mime_type=mime_type,
        used_ocr=True,
    )


def _fallback_pdf_extraction(
    file_bytes: bytes,
    filename: str,
    mime_type: str,
    language: str,
) -> ParseResult:
    """
    Last-resort extraction using pypdf + pytesseract for scanned PDFs.
    """
    text_parts: list[str] = []
    pages: list[PageResult] = []

    try:
        import pypdf  # type: ignore
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        for i, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            pages.append(PageResult(
                page_number=i,
                raw_text=text,
                markdown_text=text,
            ))
            text_parts.append(text)
    except Exception as exc:
        logger.error("pypdf fallback failed: %s", exc)
        pages = [PageResult(page_number=1, raw_text="", markdown_text="")]

    full_text = "\n\n".join(text_parts)
    return ParseResult(
        pages=pages,
        full_text=full_text,
        full_markdown=full_text,
        page_count=len(pages),
        source_file=filename,
        mime_type=mime_type,
        used_ocr=False,
    )
