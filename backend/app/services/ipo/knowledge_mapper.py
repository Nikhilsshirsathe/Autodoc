"""
KnowledgeMapper: Retrieve and map Knowledge Base data to section templates.

The Knowledge Base consists of:
  - extracted_fields   : structured fields (field_name, field_value, confidence, ...)
  - extracted_tables   : tabular data from documents
  - document_chunks    : raw text chunks (for supplementary context)

Knowledge field keys use dot-notation: "category.field_name"
e.g., "company.company_name", "financials.revenue", "risk.business_risks"
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from app.db.session import get_supabase_admin
from app.models.ipo.section_template import SectionTemplate, KnowledgeMapping

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Field name prefix → canonical extracted_field search patterns
# ---------------------------------------------------------------------------
# The extractor stores fields with names like:
#   "company_name", "cin", "revenue", "balance_sheet", etc.
# We map knowledge categories to search hints used when querying the KB.

CATEGORY_FIELD_PREFIXES: dict[str, list[str]] = {
    "company": ["company", "cin", "pan", "incorporation", "registered", "corporate", "website", "email", "phone"],
    "business": ["business", "product", "service", "customer", "location", "manufacturing", "mission", "vision"],
    "structure": ["company_type", "authorized", "paid_up", "subsidiary", "associate"],
    "financials": ["revenue", "net_profit", "balance_sheet", "cash_flow", "pnl", "notes", "eps", "roe", "total_assets", "net_worth"],
    "management": ["director", "kmp", "committee", "ceo", "cfo", "coo", "md", "chairman"],
    "promoters": ["promoter", "promoter_group", "promoter_holding"],
    "shareholding": ["shareholder", "shareholding", "share_capital", "demat"],
    "risk": ["risk", "threat", "hazard"],
    "compliance": ["compliance", "regulatory", "violation", "sebi", "roc"],
    "litigation": ["litigation", "legal", "court", "case", "dispute", "arbitration"],
    "issue": ["issue_size", "price_band", "face_value", "lot_size", "ipo", "issue_date", "issue_type"],
    "exchange": ["exchange", "nse", "bse", "listing"],
    "registrar": ["registrar", "rta", "transfer"],
    "industry": ["industry", "sector", "market", "competition", "competitor"],
    "governance": ["governance", "board", "committee", "audit", "remuneration"],
    "dividend": ["dividend", "payout"],
    "related_party": ["related_party", "rpt", "transaction"],
    "objects": ["objects_of_issue", "fund_utilization", "capex"],
    "approvals": ["government", "approval", "license", "permit", "noc", "certificate"],
    "properties": ["property", "land", "building", "plant", "factory", "office"],
    "contracts": ["contract", "agreement", "mou", "moa"],
    "declarations": ["declaration", "certification"],
    "statutory": ["statutory", "law", "regulation", "act"],
    "strategy": ["strategy", "plan", "expansion", "growth"],
    "history": ["history", "milestone", "founded", "established"],
    "mda": ["mda", "management_discussion", "financial_performance"],
}


class KnowledgeMapper:
    """
    Maps section template knowledge requirements to Knowledge Base queries
    and retrieves only the data relevant to that section.
    """

    def __init__(self, user_id: Optional[str] = None):
        """
        Args:
            user_id: Optional user ID for scoping queries.
                     When provided, only documents belonging to this user are queried.
        """
        self.supabase = get_supabase_admin()
        self.user_id = user_id

    # ------------------------------------------------------------------
    # Main entry point
    # ------------------------------------------------------------------

    def get_knowledge_for_section(self, template: SectionTemplate) -> dict[str, Any]:
        """
        Retrieve all relevant knowledge for a given section template.

        Returns a nested dict:
        {
            "company": {
                "company_name": {"value": "Acme Ltd", "confidence": 0.95, "source": "..."},
                "cin": {"value": "U12345", ...},
            },
            "financials": {
                "revenue": {"value": "₹120 Crores", ...},
            },
            "_metadata": {
                "total_fields_found": 12,
                "document_ids_used": [...],
            }
        }
        """
        result: dict[str, Any] = {}
        document_ids_used: set[str] = set()
        total_found = 0

        for km in template.knowledge_mapping:
            category_data = self._fetch_category_fields(km, document_ids_used)
            if category_data:
                result[km.category] = category_data
                total_found += len(category_data)

        result["_metadata"] = {
            "total_fields_found": total_found,
            "document_ids_used": list(document_ids_used),
        }

        logger.debug(
            f"Knowledge fetch for '{template.id}': {total_found} fields from "
            f"{len(document_ids_used)} documents"
        )
        return result

    # ------------------------------------------------------------------
    # Field fetching
    # ------------------------------------------------------------------

    def _fetch_category_fields(
        self, km: KnowledgeMapping, document_ids_used: set[str]
    ) -> dict[str, Any]:
        """
        Fetch fields for a single KnowledgeMapping.
        Returns dict: {field_name: {value, confidence, source_doc, page_number}}
        """
        result: dict[str, Any] = {}

        # Build search terms: explicit field names from the mapping
        field_names_to_search = km.fields if km.fields else []

        # Also add category-based prefix terms
        prefix_terms = CATEGORY_FIELD_PREFIXES.get(km.category, [km.category])

        # Query extracted_fields for explicit field names first
        for field_name in field_names_to_search:
            rows = self._query_extracted_fields_exact(field_name)
            if rows:
                best = self._pick_best_field(rows)
                result[field_name] = {
                    "value": best.get("field_value", ""),
                    "confidence": best.get("confidence", 0.0),
                    "source_document_id": best.get("document_id", ""),
                    "source_document_name": (best.get("documents") or {}).get("original_name", ""),
                    "page_number": best.get("page_number"),
                    "field_type": best.get("field_type", "text"),
                }
                document_ids_used.add(best.get("document_id", ""))

        # Also try fuzzy matches using prefix terms (fills gaps)
        for term in prefix_terms:
            rows = self._query_extracted_fields_fuzzy(term)
            for row in rows:
                field_name = row.get("field_name", "")
                # Normalize field name to avoid clashes
                normalized = field_name.lower().replace(" ", "_")
                if normalized not in result:
                    result[normalized] = {
                        "value": row.get("field_value", ""),
                        "confidence": row.get("confidence", 0.0),
                        "source_document_id": row.get("document_id", ""),
                        "source_document_name": (row.get("documents") or {}).get("original_name", ""),
                        "page_number": row.get("page_number"),
                        "field_type": row.get("field_type", "text"),
                    }
                    document_ids_used.add(row.get("document_id", ""))

        return result

    def _query_extracted_fields_exact(self, field_name: str) -> list[dict]:
        """Query extracted_fields for an exact field_name match (case-insensitive)."""
        try:
            query = (
                self.supabase.table("extracted_fields")
                .select("*, documents(original_name, uploaded_by)")
                .ilike("field_name", field_name)
                .order("confidence", desc=True)
                .limit(5)
            )
            if self.user_id:
                # Filter by user ownership via join - use document_id in sub-filtering
                result = query.execute()
                rows = result.data or []
                # Filter rows by user ownership
                return [
                    r for r in rows
                    if r.get("documents", {}) and
                    r["documents"].get("uploaded_by") == self.user_id
                ]
            else:
                result = query.execute()
                return result.data or []
        except Exception as exc:
            logger.warning(f"Exact field query failed for '{field_name}': {exc}")
            return []

    def _query_extracted_fields_fuzzy(self, term: str, limit: int = 10) -> list[dict]:
        """Query extracted_fields with ILIKE fuzzy match on field_name."""
        try:
            query = (
                self.supabase.table("extracted_fields")
                .select("*, documents(original_name, uploaded_by)")
                .ilike("field_name", f"%{term}%")
                .order("confidence", desc=True)
                .limit(limit)
            )
            result = query.execute()
            rows = result.data or []
            if self.user_id:
                rows = [
                    r for r in rows
                    if r.get("documents", {}) and
                    r["documents"].get("uploaded_by") == self.user_id
                ]
            return rows
        except Exception as exc:
            logger.warning(f"Fuzzy field query failed for term '{term}': {exc}")
            return []

    def _pick_best_field(self, rows: list[dict]) -> dict:
        """Select the field row with highest confidence."""
        return max(rows, key=lambda r: r.get("confidence", 0.0))

    # ------------------------------------------------------------------
    # Check field presence
    # ------------------------------------------------------------------

    def check_field_exists(self, field_key: str) -> bool:
        """
        Check if a dot-notation field (e.g., "company.company_name") exists
        in the knowledge base.

        Args:
            field_key: Dot-notation key like "financials.revenue"

        Returns:
            bool
        """
        parts = field_key.split(".", 1)
        field_name = parts[1] if len(parts) > 1 else parts[0]
        rows = self._query_extracted_fields_exact(field_name)
        if rows:
            return True
        # Try fuzzy with original field_name
        fuzzy = self._query_extracted_fields_fuzzy(field_name, limit=1)
        return len(fuzzy) > 0

    def count_available_fields(self) -> int:
        """Return total number of extracted fields in the KB for this user."""
        try:
            query = self.supabase.table("extracted_fields").select("id", count="exact")
            if self.user_id:
                # Get document IDs for this user
                docs_result = (
                    self.supabase.table("documents")
                    .select("id")
                    .eq("uploaded_by", self.user_id)
                    .execute()
                )
                doc_ids = [d["id"] for d in (docs_result.data or [])]
                if doc_ids:
                    query = query.in_("document_id", doc_ids)
            result = query.execute()
            return result.count or 0
        except Exception as exc:
            logger.warning(f"count_available_fields failed: {exc}")
            return 0

    def format_knowledge_for_prompt(self, knowledge: dict) -> str:
        """
        Convert the knowledge dict to a structured text block
        suitable for injection into a prompt template.

        Args:
            knowledge: Dict from get_knowledge_for_section()

        Returns:
            str: Formatted text block
        """
        lines: list[str] = []
        for category, fields in knowledge.items():
            if category == "_metadata":
                continue
            lines.append(f"\n### {category.upper()}")
            if isinstance(fields, dict):
                for field_name, field_data in fields.items():
                    if isinstance(field_data, dict):
                        value = field_data.get("value", "[Not Available]")
                        confidence = field_data.get("confidence", 0.0)
                        page = field_data.get("page_number", "")
                        page_str = f" (Page {page})" if page else ""
                        confidence_str = f" [confidence: {confidence:.0%}]" if confidence else ""
                        lines.append(f"  {field_name}: {value}{page_str}{confidence_str}")
                    else:
                        lines.append(f"  {field_name}: {field_data}")

        return "\n".join(lines) if lines else "No knowledge data available."
