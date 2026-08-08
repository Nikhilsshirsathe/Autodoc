"""
IPO document field extractor.

Extracts structured fields from IPO documents using:
1. Regex patterns for known fields (fast, deterministic)
2. Optional LLM extraction for complex fields
"""
from __future__ import annotations

import re
import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class ExtractedField:
    field_name: str
    field_value: str
    field_type: str = "text"    # text, number, date, percentage, currency
    page_number: Optional[int] = None
    confidence: float = 1.0
    extraction_method: str = "regex"


# ── Regex patterns for common IPO document fields ────────────────────────────

IPO_FIELD_PATTERNS: list[dict] = [
    # Company info
    {
        "field_name": "company_name",
        "pattern": r"(?i)(?:company\s+name|issuer\s+name)[:\s]+([A-Za-z0-9\s,\.&'-]{3,80})",
        "type": "text",
    },
    {
        "field_name": "cin",
        "pattern": r"\b([UL][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6})\b",
        "type": "text",
    },
    # IPO details
    {
        "field_name": "issue_price",
        "pattern": r"(?i)issue\s+price[:\s₹Rs.]*\s*([0-9,]+(?:\.[0-9]+)?)\s*(?:per\s+(?:equity\s+)?share)?",
        "type": "currency",
    },
    {
        "field_name": "price_band",
        "pattern": r"(?i)price\s+band[:\s₹Rs.]*\s*([0-9,]+)\s*[-–to]+\s*([0-9,]+)",
        "type": "text",
    },
    {
        "field_name": "issue_size",
        "pattern": r"(?i)(?:total\s+)?issue\s+size[:\s₹Rs.]*\s*([0-9,]+(?:\.[0-9]+)?)\s*(crore|lakh|million|billion)?",
        "type": "currency",
    },
    {
        "field_name": "face_value",
        "pattern": r"(?i)face\s+value[:\s₹Rs.]*\s*([0-9,]+(?:\.[0-9]+)?)\s*(?:per\s+(?:equity\s+)?share)?",
        "type": "currency",
    },
    {
        "field_name": "lot_size",
        "pattern": r"(?i)(?:minimum\s+)?(?:bid\s+)?lot\s+(?:size)?[:\s]*([0-9,]+)\s*(?:shares?|equity shares?)?",
        "type": "number",
    },
    # Dates
    {
        "field_name": "issue_open_date",
        "pattern": r"(?i)issue\s+opens?(?:\s+on)?[:\s]*([A-Za-z0-9,\s]+(?:202[0-9]|201[0-9]))",
        "type": "date",
    },
    {
        "field_name": "issue_close_date",
        "pattern": r"(?i)issue\s+closes?(?:\s+on)?[:\s]*([A-Za-z0-9,\s]+(?:202[0-9]|201[0-9]))",
        "type": "date",
    },
    {
        "field_name": "listing_date",
        "pattern": r"(?i)(?:tentative\s+)?listing\s+date[:\s]*([A-Za-z0-9,\s]+(?:202[0-9]|201[0-9]))",
        "type": "date",
    },
    # Financials
    {
        "field_name": "revenue",
        "pattern": r"(?i)(?:total\s+)?revenue(?:\s+from\s+operations)?[:\s₹Rs.]*\s*([0-9,]+(?:\.[0-9]+)?)\s*(crore|lakh|million)?",
        "type": "currency",
    },
    {
        "field_name": "net_profit",
        "pattern": r"(?i)(?:net\s+profit|pat|profit\s+after\s+tax)[:\s₹Rs.]*\s*([0-9,]+(?:\.[0-9]+)?)\s*(crore|lakh|million)?",
        "type": "currency",
    },
    {
        "field_name": "eps",
        "pattern": r"(?i)(?:basic\s+)?(?:diluted\s+)?eps[:\s₹Rs.]*\s*([0-9,]+(?:\.[0-9]+)?)",
        "type": "number",
    },
    {
        "field_name": "pe_ratio",
        "pattern": r"(?i)p[\s/]?e\s+(?:ratio)?[:\s]*([0-9,]+(?:\.[0-9]+)?)\s*(?:x|times)?",
        "type": "number",
    },
    # Registrar
    {
        "field_name": "registrar",
        "pattern": r"(?i)registrar(?:\s+to\s+(?:the\s+)?issue)?[:\s]+([A-Za-z\s,\.&'-]{5,100})",
        "type": "text",
    },
    # SEBI
    {
        "field_name": "sebi_registration",
        "pattern": r"(?i)sebi\s+(?:registration|reg)\.?\s+(?:no\.?|number)[:\s]*(INR[A-Z0-9]+|[A-Z]{3}[0-9]+)",
        "type": "text",
    },
    # GMP / subscription
    {
        "field_name": "subscription_overall",
        "pattern": r"(?i)overall\s+subscription[:\s]*([0-9,]+(?:\.[0-9]+)?)\s*(?:times?|x)",
        "type": "number",
    },
]


def extract_fields_from_text(
    text: str,
    page_number: Optional[int] = None,
    use_llm: bool = False,
) -> list[ExtractedField]:
    """
    Run regex patterns over the text and return extracted fields.
    """
    results: list[ExtractedField] = []
    seen_fields: set[str] = set()

    for pattern_def in IPO_FIELD_PATTERNS:
        fname = pattern_def["field_name"]
        if fname in seen_fields:
            continue

        try:
            match = re.search(pattern_def["pattern"], text)
            if match:
                # Combine all capture groups
                value = " ".join(g.strip() for g in match.groups() if g and g.strip())
                results.append(ExtractedField(
                    field_name=fname,
                    field_value=value,
                    field_type=pattern_def["type"],
                    page_number=page_number,
                    confidence=0.85,
                    extraction_method="regex",
                ))
                seen_fields.add(fname)
        except re.error as e:
            logger.warning("Regex error for field %s: %s", fname, e)

    return results


def extract_fields_from_pages(pages: list) -> list[ExtractedField]:
    """Extract fields across all pages, deduplicating by field_name."""
    all_fields: list[ExtractedField] = []
    seen: set[str] = set()

    for page in pages:
        text = page.markdown_text or page.raw_text or ""
        if not text.strip():
            continue
        for ef in extract_fields_from_text(text, page_number=page.page_number):
            if ef.field_name not in seen:
                all_fields.append(ef)
                seen.add(ef.field_name)

    return all_fields
