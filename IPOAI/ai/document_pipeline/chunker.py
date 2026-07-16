"""
Text chunker — splits document text into overlapping chunks for RAG / embeddings.
"""
from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class Chunk:
    chunk_index: int
    text: str
    token_count: int
    page_number: int | None = None
    metadata: dict | None = None


def _estimate_tokens(text: str) -> int:
    """Rough token estimate: ~4 chars per token for English text."""
    return max(1, len(text) // 4)


def chunk_text(
    text: str,
    chunk_size: int = 512,        # tokens
    chunk_overlap: int = 64,      # tokens
    page_number: int | None = None,
    metadata: dict | None = None,
) -> list[Chunk]:
    """
    Split text into overlapping token-sized chunks.
    Uses sentence boundaries where possible.
    """
    if not text or not text.strip():
        return []

    # Split on sentence boundaries
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    sentences = [s.strip() for s in sentences if s.strip()]

    chunks: list[Chunk] = []
    current: list[str] = []
    current_tokens = 0
    chunk_idx = 0

    for sentence in sentences:
        sent_tokens = _estimate_tokens(sentence)

        # If single sentence exceeds chunk_size, hard-split it
        if sent_tokens > chunk_size:
            # flush current buffer first
            if current:
                chunk_text_str = " ".join(current)
                chunks.append(Chunk(
                    chunk_index=chunk_idx,
                    text=chunk_text_str,
                    token_count=_estimate_tokens(chunk_text_str),
                    page_number=page_number,
                    metadata=metadata or {},
                ))
                chunk_idx += 1
                current = []
                current_tokens = 0

            # Hard-split the long sentence by words
            words = sentence.split()
            word_buffer: list[str] = []
            word_tokens = 0
            for word in words:
                wt = _estimate_tokens(word)
                if word_tokens + wt > chunk_size and word_buffer:
                    chunk_text_str = " ".join(word_buffer)
                    chunks.append(Chunk(
                        chunk_index=chunk_idx,
                        text=chunk_text_str,
                        token_count=_estimate_tokens(chunk_text_str),
                        page_number=page_number,
                        metadata=metadata or {},
                    ))
                    chunk_idx += 1
                    # overlap: keep last N words
                    overlap_words = word_buffer[-max(1, chunk_overlap // 4):]
                    word_buffer = overlap_words
                    word_tokens = sum(_estimate_tokens(w) for w in overlap_words)
                word_buffer.append(word)
                word_tokens += wt
            if word_buffer:
                chunk_text_str = " ".join(word_buffer)
                chunks.append(Chunk(
                    chunk_index=chunk_idx,
                    text=chunk_text_str,
                    token_count=_estimate_tokens(chunk_text_str),
                    page_number=page_number,
                    metadata=metadata or {},
                ))
                chunk_idx += 1
            continue

        # Normal path: accumulate until chunk_size
        if current_tokens + sent_tokens > chunk_size and current:
            chunk_text_str = " ".join(current)
            chunks.append(Chunk(
                chunk_index=chunk_idx,
                text=chunk_text_str,
                token_count=_estimate_tokens(chunk_text_str),
                page_number=page_number,
                metadata=metadata or {},
            ))
            chunk_idx += 1

            # Keep overlap: last sentences that fit in overlap window
            overlap_tokens = 0
            overlap_sents: list[str] = []
            for s in reversed(current):
                st = _estimate_tokens(s)
                if overlap_tokens + st <= chunk_overlap:
                    overlap_sents.insert(0, s)
                    overlap_tokens += st
                else:
                    break
            current = overlap_sents
            current_tokens = overlap_tokens

        current.append(sentence)
        current_tokens += sent_tokens

    # Flush remaining
    if current:
        chunk_text_str = " ".join(current)
        chunks.append(Chunk(
            chunk_index=chunk_idx,
            text=chunk_text_str,
            token_count=_estimate_tokens(chunk_text_str),
            page_number=page_number,
            metadata=metadata or {},
        ))

    return chunks


def chunk_document_pages(
    pages: list,   # list of PageResult from parser
    chunk_size: int = 512,
    chunk_overlap: int = 64,
) -> list[Chunk]:
    """Chunk all pages, carrying page_number metadata per chunk."""
    all_chunks: list[Chunk] = []
    global_idx = 0

    for page in pages:
        page_chunks = chunk_text(
            text=page.markdown_text or page.raw_text,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            page_number=page.page_number,
        )
        for c in page_chunks:
            c.chunk_index = global_idx
            global_idx += 1
            all_chunks.append(c)

    return all_chunks
