"""
RAG (Retrieval-Augmented Generation) endpoints.

Provides:
  POST /api/v1/rag/query                — semantic/text search over document chunks
  POST /api/v1/rag/generate-draft-section — generate an IPO section draft via GPT
  POST /api/v1/rag/chat                 — ChatGPT-like Q&A over user's documents
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.core.config import settings
from app.db.session import get_supabase_admin

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Request / response schemas ────────────────────────────────────────────────

class RAGQueryRequest(BaseModel):
    query: str
    user_id: str
    document_ids: Optional[list[str]] = None


class ChunkResult(BaseModel):
    chunk_id: str
    document_id: str
    chunk_text: str
    chunk_index: Optional[int] = None
    document_name: Optional[str] = None
    page_number: Optional[int] = None


class RAGQueryResponse(BaseModel):
    query: str
    chunks: list[ChunkResult]
    total_found: int


class GenerateDraftRequest(BaseModel):
    section_code: str
    section_title: str
    user_id: str
    document_ids: Optional[list[str]] = None


class SourceReference(BaseModel):
    document_id: str
    document_name: Optional[str] = None
    chunk_ids: list[str]


class GenerateDraftResponse(BaseModel):
    section_code: str
    content: str
    confidence: float
    word_count: int
    sources: list[SourceReference]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _fetch_chunks(
    query: str,
    user_id: str,
    document_ids: Optional[list[str]],
    limit: int = 5,
) -> list[dict]:
    """
    Search document_chunks using keyword extraction + ilike text match.
    Tries each significant keyword individually, deduplicates results.
    Falls back to the first `limit` chunks from the user's documents
    so the AI always has context to work with.
    """
    supabase = get_supabase_admin()

    SELECT = (
        "id, document_id, chunk_text, chunk_index, "
        "document_pages(page_number), "
        "documents(filename, uploaded_by)"
    )

    # ── Ownership filter helper ──────────────────────────────────────────────
    def _owned(rows: list[dict]) -> list[dict]:
        if document_ids:
            return rows
        return [
            r for r in rows
            if r.get("documents", {}) and r["documents"].get("uploaded_by") == user_id
        ]

    # ── Extract meaningful keywords (ignore short/stop words) ───────────────
    STOP = {"what", "is", "the", "a", "an", "of", "in", "on", "at", "to",
            "for", "with", "are", "was", "were", "has", "have", "had",
            "its", "their", "this", "that", "which", "how", "who", "when",
            "where", "why", "does", "do", "did", "can", "could", "will",
            "would", "should", "name", "tell", "me", "give", "please", "list"}
    words = [w.strip("?.,'\"") for w in query.lower().split()]
    keywords = [w for w in words if len(w) > 3 and w not in STOP]

    # Always add the full query as the first search term
    search_terms = []
    if len(query) < 80:          # only if query itself is short enough
        search_terms.append(query)
    search_terms.extend(keywords[:4])   # up to 4 keywords
    if not search_terms:
        search_terms = [query]

    seen_ids: set[str] = set()
    collected: list[dict] = []

    for term in search_terms:
        if len(collected) >= limit:
            break
        q = supabase.table("document_chunks").select(SELECT).ilike("chunk_text", f"%{term}%")
        if document_ids:
            q = q.in_("document_id", document_ids)
        rows = _owned(q.limit(limit).execute().data or [])
        for row in rows:
            if row["id"] not in seen_ids:
                seen_ids.add(row["id"])
                collected.append(row)
            if len(collected) >= limit:
                break

    # ── Fallback: if still no results, return first chunks from user's docs ─
    if not collected:
        q = supabase.table("document_chunks").select(SELECT).order("chunk_index")
        if document_ids:
            q = q.in_("document_id", document_ids)
        rows = _owned(q.limit(limit).execute().data or [])
        collected = rows

    return collected[:limit]


def _rows_to_chunk_results(rows: list[dict]) -> list[ChunkResult]:
    chunks: list[ChunkResult] = []
    for row in rows:
        doc_info  = row.get("documents") or {}
        page_info = row.get("document_pages") or {}
        chunks.append(
            ChunkResult(
                chunk_id=row["id"],
                document_id=row["document_id"],
                chunk_text=row["chunk_text"],
                chunk_index=row.get("chunk_index"),
                document_name=doc_info.get("filename"),
                page_number=page_info.get("page_number"),
            )
        )
    return chunks


def _build_sources(chunks: list[ChunkResult]) -> list[SourceReference]:
    """Aggregate chunk IDs by document."""
    doc_map: dict[str, SourceReference] = {}
    for chunk in chunks:
        if chunk.document_id not in doc_map:
            doc_map[chunk.document_id] = SourceReference(
                document_id=chunk.document_id,
                document_name=chunk.document_name,
                chunk_ids=[],
            )
        doc_map[chunk.document_id].chunk_ids.append(chunk.chunk_id)
    return list(doc_map.values())


def _call_openai(prompt: str) -> str:
    """Call OpenAI chat completion and return the assistant message text."""
    from openai import OpenAI

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    response = client.chat.completions.create(
        model=settings.OPENAI_CHAT_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an expert financial and legal writer specialising in "
                    "IPO (Initial Public Offering) offer documents. You write clear, "
                    "professional, and accurate content for regulatory prospectuses and "
                    "offer documents. Always cite the source material provided and do not "
                    "fabricate financial figures or legal claims."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
        max_tokens=1500,
    )
    return response.choices[0].message.content or ""


def _estimate_confidence(chunks: list[ChunkResult]) -> float:
    """
    Simple heuristic: confidence scales with number of chunks found.
    0 chunks → 0.10, 5 chunks → 0.90, interpolated linearly.
    """
    if not chunks:
        return 0.10
    score = min(0.10 + len(chunks) * 0.16, 0.90)
    return round(score, 2)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "/query",
    response_model=RAGQueryResponse,
    status_code=status.HTTP_200_OK,
    summary="Search document chunks",
)
async def rag_query(body: RAGQueryRequest) -> RAGQueryResponse:
    """
    Search the `document_chunks` table for text relevant to `query`.

    - Performs a case-insensitive ILIKE match on `chunk_text`.
    - If `document_ids` is supplied, restricts the search to those documents.
    - Otherwise searches across all documents owned by `user_id`.
    - Returns the top 5 matching chunks with document metadata.
    """
    if not body.query.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="query must not be empty",
        )

    try:
        rows = _fetch_chunks(
            query=body.query,
            user_id=body.user_id,
            document_ids=body.document_ids,
            limit=5,
        )
        chunks = _rows_to_chunk_results(rows)
        return RAGQueryResponse(
            query=body.query,
            chunks=chunks,
            total_found=len(chunks),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("RAG query failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"RAG query failed: {str(exc)}",
        )


@router.post(
    "/generate-draft-section",
    response_model=GenerateDraftResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate an IPO document section draft",
)
async def generate_draft_section(body: GenerateDraftRequest) -> GenerateDraftResponse:
    """
    Use RAG to retrieve relevant document chunks and then call OpenAI GPT to
    generate a draft for the specified IPO section.

    Returns the generated content along with:
    - `confidence`: a heuristic score (0–1) based on context availability
    - `word_count`: number of words in the generated content
    - `sources`: the documents and chunk IDs used as context
    """
    if not body.section_code.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="section_code must not be empty",
        )
    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenAI API key is not configured",
        )

    try:
        # 1. Retrieve relevant chunks using the section title as the query
        search_query = body.section_title or body.section_code
        rows = _fetch_chunks(
            query=search_query,
            user_id=body.user_id,
            document_ids=body.document_ids,
            limit=5,
        )
        chunks = _rows_to_chunk_results(rows)

        # 2. Build context block from retrieved chunks
        if chunks:
            context_lines = []
            for i, chunk in enumerate(chunks, start=1):
                doc_label = chunk.document_name or chunk.document_id
                context_lines.append(
                    f"[Source {i} — {doc_label}]:\n{chunk.chunk_text.strip()}"
                )
            context_block = "\n\n".join(context_lines)
        else:
            context_block = (
                "No specific source documents were found for this section. "
                "Please draft this section based on general IPO best practices."
            )

        # 3. Build prompt
        prompt = (
            f"You are drafting the '{body.section_title}' section (code: {body.section_code}) "
            f"of an IPO offer document / prospectus.\n\n"
            f"Use the following extracted source material as context:\n\n"
            f"---\n{context_block}\n---\n\n"
            f"Write a complete, professional draft for this section. "
            f"The content should be suitable for inclusion in a regulatory IPO prospectus. "
            f"Use formal language, include relevant details from the source material, "
            f"and structure the text with clear paragraphs. "
            f"Do not include a heading — write only the body content."
        )

        # 4. Call OpenAI
        content = _call_openai(prompt)

        # 5. Compile response
        sources = _build_sources(chunks)
        confidence = _estimate_confidence(chunks)
        word_count = len(content.split())

        return GenerateDraftResponse(
            section_code=body.section_code,
            content=content,
            confidence=confidence,
            word_count=word_count,
            sources=sources,
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            "Draft generation failed for section %s: %s",
            body.section_code,
            exc,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Draft generation failed: {str(exc)}",
        )



# ── Chat endpoint ─────────────────────────────────────────────────────────────

class ChatSource(BaseModel):
    document_name: Optional[str] = None
    document_id: str
    page_number: Optional[int] = None
    chunk_text: str


class ChatRequest(BaseModel):
    question: str
    user_id: str
    document_ids: Optional[list[str]] = None


class ChatResponse(BaseModel):
    answer: str
    sources: list[ChatSource]


@router.post(
    "/chat",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Ask a question and get an AI answer grounded in uploaded documents",
)
async def rag_chat(body: ChatRequest) -> ChatResponse:
    """
    Retrieves the most relevant document chunks for the question,
    then asks OpenAI to answer using only that context.
    Returns the answer text plus source references.
    """
    if not body.question.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="question must not be empty",
        )
    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenAI API key is not configured",
        )

    try:
        # 1. Retrieve relevant chunks
        rows = _fetch_chunks(
            query=body.question,
            user_id=body.user_id,
            document_ids=body.document_ids,
            limit=6,
        )
        chunks = _rows_to_chunk_results(rows)

        # 2. Build context block
        if chunks:
            context_lines = []
            for i, chunk in enumerate(chunks, start=1):
                doc_label = chunk.document_name or chunk.document_id
                page_info = f", page {chunk.page_number}" if chunk.page_number else ""
                context_lines.append(
                    f"[Source {i} — {doc_label}{page_info}]:\n{chunk.chunk_text.strip()}"
                )
            context_block = "\n\n".join(context_lines)
        else:
            context_block = "No relevant content found in the uploaded documents."

        # 3. Build prompt
        prompt = (
            f"You are an AI assistant for an IPO document platform. "
            f"Answer the user's question using ONLY the source material provided below. "
            f"If the answer is not present in the sources, clearly say so. "
            f"Be concise, factual, and cite which source you are drawing from.\n\n"
            f"SOURCE MATERIAL:\n---\n{context_block}\n---\n\n"
            f"USER QUESTION: {body.question}\n\n"
            f"ANSWER:"
        )

        # 4. Call OpenAI
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        response = client.chat.completions.create(
            model=settings.OPENAI_CHAT_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a knowledgeable financial and legal analyst specialising "
                        "in IPO documents. Answer questions accurately and concisely based "
                        "only on the provided source material. Cite sources when relevant."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            max_tokens=1000,
        )
        answer = response.choices[0].message.content or "I could not generate an answer."

        # 5. Build source list
        sources = [
            ChatSource(
                document_name=c.document_name,
                document_id=c.document_id,
                page_number=c.page_number,
                chunk_text=c.chunk_text[:300],
            )
            for c in chunks
        ]

        return ChatResponse(answer=answer, sources=sources)

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("RAG chat failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chat failed: {str(exc)}",
        )
