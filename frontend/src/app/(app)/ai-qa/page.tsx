"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Send, Sparkles, Loader2, FileText, User, ChevronDown,
  ChevronRight, RefreshCw, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { listDocuments, type ApiDocument } from "@/lib/data/documents";
import { useAuth } from "@/context/auth-context";
import { useProject } from "@/context/project-context";
import { getDocIdsForProject } from "@/lib/project-doc-map";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatSource {
  document_name: string | null;
  document_id: string;
  page_number: number | null;
  chunk_text: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  loading?: boolean;
  error?: boolean;
}

// ── Suggested questions ───────────────────────────────────────────────────────

const SUGGESTIONS = [
  "What is the company's CIN number?",
  "Who are the key directors on the board?",
  "What is the total revenue for the latest financial year?",
  "What are the main risk factors mentioned?",
  "What is the issue size and price band?",
  "Summarise the company's business overview.",
];

// ── Source card ───────────────────────────────────────────────────────────────

function SourceCard({ source, index }: { source: ChatSource; index: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <button
      onClick={() => setExpanded((v) => !v)}
      className="w-full text-left rounded-lg border border-border bg-muted/40 hover:bg-muted/70 transition-colors px-3 py-2"
    >
      <div className="flex items-center gap-2">
        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-foreground truncate flex-1">
          {source.document_name ?? "Document"}
          {source.page_number ? ` · p.${source.page_number}` : ""}
        </span>
        <span className="text-[10px] text-muted-foreground shrink-0">Source {index + 1}</span>
        {expanded
          ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
          : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
      </div>
      {expanded && (
        <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed border-t border-border pt-2">
          {source.chunk_text}
        </p>
      )}
    </button>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  const [showSources, setShowSources] = useState(false);

  return (
    <div className={cn("flex gap-3 max-w-3xl", isUser ? "ml-auto flex-row-reverse" : "")}>
      {/* Avatar */}
      <div className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full shrink-0 mt-0.5",
        isUser ? "bg-primary" : "bg-muted border border-border",
      )}>
        {isUser
          ? <User className="h-4 w-4 text-primary-foreground" />
          : <Sparkles className="h-4 w-4 text-foreground" />}
      </div>

      {/* Content */}
      <div className={cn("flex flex-col gap-2 min-w-0 flex-1", isUser ? "items-end" : "items-start")}>
        <div className={cn(
          "px-4 py-3 rounded-2xl text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : msg.error
            ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-tl-sm"
            : "bg-muted border border-border rounded-tl-sm",
        )}>
          {msg.loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Searching knowledge base…</span>
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          )}
        </div>

        {/* Sources */}
        {!isUser && msg.sources && msg.sources.length > 0 && (
          <div className="w-full max-w-xl">
            <button
              onClick={() => setShowSources((v) => !v)}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors mb-1.5"
            >
              <BookOpen className="h-3 w-3" />
              {msg.sources.length} source{msg.sources.length !== 1 ? "s" : ""} referenced
              {showSources
                ? <ChevronDown className="h-3 w-3" />
                : <ChevronRight className="h-3 w-3" />}
            </button>
            {showSources && (
              <div className="space-y-1.5">
                {msg.sources.map((src, i) => (
                  <SourceCard key={i} source={src} index={i} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AIQAPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { selectedProjectId, selectedProject } = useProject();
  const userId = user?.id ?? "";

  const [messages, setMessages]     = useState<Message[]>([]);
  const [input, setInput]           = useState("");
  const [sending, setSending]       = useState(false);
  const [docs, setDocs]             = useState<ApiDocument[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Load documents for the filter pill list ─────────────────────────────────
  useEffect(() => {
    if (authLoading || !userId) return;
    listDocuments(userId)
      .then((data) => {
        // Filter to project docs only
        if (selectedProjectId) {
          const ids = getDocIdsForProject(selectedProjectId);
          setDocs(data.filter((d) => d.project_id === selectedProjectId || ids.has(d.id)));
        } else {
          setDocs(data.filter((d) => d.status === "completed"));
        }
      })
      .catch(console.error)
      .finally(() => setLoadingDocs(false));
  }, [userId, authLoading, selectedProjectId]);

  // ── Auto-scroll to bottom ───────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Auto-resize textarea ────────────────────────────────────────────────────
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  // ── Send message ─────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (question: string) => {
    if (!question.trim() || sending) return;
    setInput("");
    setSending(true);

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: question.trim(),
    };
    const placeholderId = `ai-${Date.now()}`;
    const placeholder: Message = {
      id: placeholderId,
      role: "assistant",
      content: "",
      loading: true,
    };

    setMessages((prev) => [...prev, userMsg, placeholder]);

    try {
      const res = await fetch(`${API_URL}/api/v1/rag/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          user_id: userId,
          document_ids: selectedDocIds.length > 0 ? selectedDocIds : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "Request failed");
      }

      const data = await res.json();

      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholderId
            ? { ...m, content: data.answer, sources: data.sources, loading: false }
            : m,
        ),
      );
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholderId
            ? {
                ...m,
                content: err.message ?? "Something went wrong. Please try again.",
                loading: false,
                error: true,
              }
            : m,
        ),
      );
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }, [sending, userId, selectedDocIds]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const toggleDoc = (id: string) =>
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );

  const clearChat = () => setMessages([]);

  const isEmpty = messages.length === 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-112px)] gap-4 p-4 bg-muted/30 overflow-hidden">

      {/* ══ LEFT: DOCUMENT FILTER SIDEBAR ═══════════════════════════════════════ */}
      <div className="flex flex-col w-[240px] shrink-0 rounded-xl border border-border bg-background shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border shrink-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Knowledge Base
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {selectedDocIds.length === 0
              ? "Searching all documents"
              : `${selectedDocIds.length} document${selectedDocIds.length !== 1 ? "s" : ""} selected`}
          </p>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {loadingDocs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : docs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6 px-2">
                No processed documents. Upload and process documents first.
              </p>
            ) : (
              <>
                {/* All option */}
                <button
                  onClick={() => setSelectedDocIds([])}
                  className={cn(
                    "w-full text-left rounded-lg px-3 py-2 text-xs transition-colors",
                    selectedDocIds.length === 0
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  All documents ({docs.length})
                </button>
                <div className="border-t border-border my-1" />
                {docs.map((doc) => {
                  const selected = selectedDocIds.includes(doc.id);
                  return (
                    <button
                      key={doc.id}
                      onClick={() => toggleDoc(doc.id)}
                      className={cn(
                        "w-full text-left rounded-lg px-3 py-2 transition-colors flex items-start gap-2",
                        selected
                          ? "bg-primary/10 border border-primary/20 text-foreground"
                          : "text-muted-foreground hover:bg-muted",
                      )}
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs break-words leading-snug font-medium text-foreground">
                          {doc.original_name}
                        </p>
                        <p className="text-[10px] text-muted-foreground capitalize mt-0.5">
                          {doc.doc_type.replace(/_/g, " ")}
                          {doc.page_count ? ` · ${doc.page_count}p` : ""}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* ══ RIGHT: CHAT PANEL ════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 rounded-xl border border-border bg-background shadow-sm overflow-hidden">

        {/* Chat toolbar */}
        <div className="flex items-center justify-between h-14 px-5 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">AI Q&amp;A</p>
              <p className="text-[11px] text-muted-foreground leading-tight">
                {selectedProject ? selectedProject.company_name : "Ask anything about your documents"}
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" onClick={clearChat}>
              <RefreshCw className="h-3.5 w-3.5" />
              New chat
            </Button>
          )}
        </div>

        {/* Messages area */}
        <ScrollArea className="flex-1 px-5">
          <div className="py-6 space-y-6">
            {isEmpty ? (
              /* Welcome / empty state */
              <div className="flex flex-col items-center justify-center h-full py-12 text-center gap-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Ask anything</h2>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                    Ask questions about your uploaded documents. The AI will search the knowledge base and answer with source references.
                  </p>
                </div>
                {/* Suggested questions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="text-left text-xs px-4 py-2.5 rounded-xl border border-border bg-muted/50 hover:bg-muted hover:border-primary/30 transition-all text-foreground/80 leading-snug"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Input bar */}
        <div className="px-5 py-4 border-t border-border shrink-0">
          <div className="flex items-end gap-3 rounded-xl border border-input bg-muted/30 px-4 py-3 focus-within:border-ring/50 focus-within:ring-2 focus-within:ring-ring/20 transition-all">
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder="Ask a question about your documents… (Enter to send, Shift+Enter for new line)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending || (!userId && !authLoading)}
              className="flex-1 resize-none bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none leading-relaxed disabled:opacity-50 min-h-[24px]"
              style={{ height: "24px" }}
            />
            <Button
              size="sm"
              className="h-8 w-8 p-0 rounded-lg shrink-0"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || sending}
            >
              {sending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Answers are generated from your uploaded documents. Always verify critical information.
          </p>
        </div>
      </div>

    </div>
  );
}
