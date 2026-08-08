"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  Search, Loader2, FileText, RefreshCw, Layers, ChevronDown,
  ChevronRight, RotateCcw, TrendingUp, Shield, Gavel, Database,
  Users, Building2, FolderOpen,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listDocuments, type ApiDocument } from "@/lib/data/documents";
import { useAuth } from "@/context/auth-context";
import { useProject } from "@/context/project-context";
import { getDocIdsForProject } from "@/lib/project-doc-map";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { API_URL } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Chunk {
  id: string;
  document_id: string;
  chunk_index: number;
  chunk_text: string;
  page_number: number | null;
}

// ── Status config (mirrors viewer) ────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  completed:  { label: "Completed",  className: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800" },
  processing: { label: "Processing", className: "bg-blue-50   text-blue-700   border border-blue-200   dark:bg-blue-900/20   dark:text-blue-400   dark:border-blue-800" },
  uploaded:   { label: "Uploaded",   className: "bg-amber-50  text-amber-700  border border-amber-200  dark:bg-amber-900/20  dark:text-amber-400  dark:border-amber-800" },
  failed:     { label: "Failed",     className: "bg-red-50    text-red-700    border border-red-200    dark:bg-red-900/20    dark:text-red-400    dark:border-red-800" },
};

function StatusBadge({ status, small = false }: { status: string; small?: boolean }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.uploaded;
  return (
    <span className={cn(
      "inline-flex items-center font-medium rounded-full",
      small ? "text-[10px] px-1.5 py-0.5" : "text-[11px] px-2 py-0.5",
      cfg.className,
    )}>
      {cfg.label}
    </span>
  );
}

// ── Doc-type tab config ────────────────────────────────────────────────────────
const DOC_TYPE_META: Record<string, { label: string; icon: React.ElementType }> = {
  financials:     { label: "Financials",     icon: TrendingUp },
  ipo_prospectus: { label: "IPO Prospectus", icon: Layers     },
  annual_report:  { label: "Annual Report",  icon: FileText   },
  legal:          { label: "Legal",          icon: Gavel      },
  compliance:     { label: "Compliance",     icon: Shield     },
  shareholding:   { label: "Shareholding",   icon: Database   },
  directors:      { label: "Directors",      icon: Users      },
  company:        { label: "Company",        icon: Building2  },
  other:          { label: "Other",          icon: FolderOpen },
};

function getDocTypeMeta(rawType: string) {
  const key = rawType.toLowerCase().replace(/\s+/g, "_");
  return DOC_TYPE_META[key] ?? { label: rawType.replace(/_/g, " "), icon: FolderOpen };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchAllChunks(documentId: string): Promise<Chunk[]> {
  const res = await fetch(`${API_URL}/api/v1/documents/${documentId}/pages`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.pages ?? []).map((p: any, i: number) => ({
    id: p.id ?? String(i),
    document_id: documentId,
    chunk_index: i,
    chunk_text: (p.markdown_text || p.raw_text || "").trim(),
    page_number: p.page_number ?? null,
  }));
}

async function reprocessDocument(documentId: string): Promise<void> {
  await fetch(`${API_URL}/api/v1/documents/${documentId}/process`, { method: "POST" });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function KnowledgeBasePage() {
  const { user, isLoading: authLoading } = useAuth();
  const { selectedProjectId, selectedProject } = useProject();
  const userId = user?.id ?? "";

  const [docs, setDocs]               = useState<ApiDocument[]>([]);
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [pages, setPages]             = useState<Chunk[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [loadingPages, setLoadingPages] = useState(false);
  const [docSearch, setDocSearch]     = useState("");
  const [pageSearch, setPageSearch]   = useState("");
  const [activeType, setActiveType]   = useState<string>("all");
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [reprocessing, setReprocessing]   = useState<Set<string>>(new Set());

  // ── Load documents ──────────────────────────────────────────────────────────
  const fetchDocs = useCallback(async () => {
    if (!userId) return;
    setLoadingDocs(true);
    try {
      const data = await listDocuments(userId);
      // Filter to docs belonging to the selected project
      const filtered = selectedProjectId
        ? data.filter((d) => {
            const ids = getDocIdsForProject(selectedProjectId);
            return d.project_id === selectedProjectId || ids.has(d.id);
          })
        : data;
      setDocs(filtered);
      if (filtered.length > 0 && !selectedId) setSelectedId(filtered[0].id);
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      setLoadingDocs(false);
    }
  }, [userId, selectedProjectId]);

  useEffect(() => {
    if (!authLoading && userId) fetchDocs();
  }, [fetchDocs, authLoading, userId]);

  // ── Load pages for selected doc ─────────────────────────────────────────────
  useEffect(() => {
    if (!selectedId) return;
    setLoadingPages(true);
    setPages([]);
    setExpandedPages(new Set());
    fetchAllChunks(selectedId)
      .then(setPages)
      .catch(console.error)
      .finally(() => setLoadingPages(false));
  }, [selectedId]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const docTypes = Array.from(new Set(docs.map((d) => d.doc_type))).sort();

  const filteredDocs = docs.filter((d) => {
    const matchSearch = d.original_name.toLowerCase().includes(docSearch.toLowerCase());
    const matchType   = activeType === "all" || d.doc_type === activeType;
    return matchSearch && matchType;
  });

  const selectedDoc = docs.find((d) => d.id === selectedId) ?? null;

  const filteredPages = pageSearch
    ? pages.filter((p) => p.chunk_text.toLowerCase().includes(pageSearch.toLowerCase()))
    : pages;

  const togglePage = (id: string) =>
    setExpandedPages((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // ── Reprocess ───────────────────────────────────────────────────────────────
  const handleReprocess = async (docId: string, docName: string) => {
    setReprocessing((prev) => new Set(prev).add(docId));
    try {
      await reprocessDocument(docId);
      toast.success(`Reprocessing ${docName}`, {
        description: "Refresh in ~30 seconds to see updated content.",
      });
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        if (attempts > 20) {
          clearInterval(poll);
          setReprocessing((p) => { const n = new Set(p); n.delete(docId); return n; });
          return;
        }
        try {
          const res  = await fetch(`${API_URL}/api/v1/documents/${docId}/status`);
          const data = await res.json();
          if (data.status === "completed" || data.status === "failed") {
            clearInterval(poll);
            setReprocessing((p) => { const n = new Set(p); n.delete(docId); return n; });
            if (data.status === "completed") {
              if (docId === selectedId) {
                fetchAllChunks(docId).then(setPages).catch(console.error);
              }
              toast.success("Reprocessing complete!", { description: "Knowledge base updated." });
            } else {
              toast.error("Reprocessing failed", { description: data.error_message ?? "" });
            }
          }
        } catch { /* ignore */ }
      }, 3000);
    } catch {
      setReprocessing((prev) => { const n = new Set(prev); n.delete(docId); return n; });
      toast.error("Failed to start reprocessing");
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loadingDocs || authLoading) {
    return (
      <div className="flex h-[calc(100vh-112px)] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">Loading knowledge base…</p>
        </div>
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="flex h-[calc(100vh-112px)] items-center justify-center">
        <div className="text-center space-y-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mx-auto">
            <FileText className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-base font-semibold">No documents yet</p>
          <p className="text-sm text-muted-foreground">
            Go to <strong>Documents → Upload</strong> to add documents.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-112px)] gap-4 p-4 bg-muted/30 overflow-hidden">

      {/* ══ LEFT SIDEBAR ════════════════════════════════════════════════════════ */}
      <div className="flex flex-col w-[280px] shrink-0 rounded-xl border border-border bg-background shadow-sm overflow-hidden">

        {/* Sidebar header */}
        <div className="px-4 py-3 border-b border-border shrink-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2.5">
            Documents ({docs.length})
          </p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search documents…"
              value={docSearch}
              onChange={(e) => setDocSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-input bg-muted/50 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring/50 transition-all"
            />
          </div>
        </div>

        {/* Doc-type filter tabs */}
        {docTypes.length > 1 && (
          <div className="px-3 pt-2 pb-1 border-b border-border shrink-0 overflow-x-auto">
            <div className="flex gap-1 min-w-max">
              <button
                onClick={() => setActiveType("all")}
                className={cn(
                  "text-[11px] px-2 py-0.5 rounded-md font-medium transition-colors",
                  activeType === "all"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                All ({docs.length})
              </button>
              {docTypes.map((type) => {
                const { label } = getDocTypeMeta(type);
                const count = docs.filter((d) => d.doc_type === type).length;
                return (
                  <button
                    key={type}
                    onClick={() => setActiveType(type)}
                    className={cn(
                      "text-[11px] px-2 py-0.5 rounded-md font-medium transition-colors whitespace-nowrap capitalize",
                      activeType === type
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {label} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Document list */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredDocs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No results</p>
            ) : (
              filteredDocs.map((doc) => {
                const active = doc.id === selectedId;
                return (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedId(doc.id)}
                    className={cn(
                      "w-full text-left rounded-lg px-3 py-2.5 transition-all duration-150",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-foreground",
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg shrink-0 mt-0.5",
                        active ? "bg-white/15" : "bg-muted",
                      )}>
                        <FileText className={cn(
                          "h-4 w-4",
                          active ? "text-primary-foreground" : "text-muted-foreground",
                        )} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn(
                          "text-sm font-medium break-words leading-snug",
                          active ? "text-primary-foreground" : "text-foreground",
                        )}>
                          {doc.original_name}
                        </p>
                        <p className={cn(
                          "text-xs mt-0.5 capitalize",
                          active ? "text-primary-foreground/70" : "text-muted-foreground",
                        )}>
                          {doc.doc_type.replace(/_/g, " ")}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          {active ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-white/20 text-primary-foreground">
                              {doc.status}
                            </span>
                          ) : (
                            <StatusBadge status={doc.status} small />
                          )}
                          {doc.page_count && (
                            <span className={cn(
                              "text-[11px]",
                              active ? "text-primary-foreground/60" : "text-muted-foreground",
                            )}>
                              {doc.page_count} pages
                            </span>
                          )}
                        </div>
                      </div>
                      {active && (
                        <ChevronRight className="h-4 w-4 text-primary-foreground/50 shrink-0 mt-2" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* ══ RIGHT: PAGES PANEL ══════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 rounded-xl border border-border bg-background shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center gap-3 h-14 px-5 border-b border-border shrink-0">
          {selectedDoc ? (
            <>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-foreground leading-tight">
                  {selectedDoc.original_name}
                </p>
                <p className="text-xs text-muted-foreground capitalize leading-tight mt-0.5">
                  {selectedDoc.doc_type.replace(/_/g, " ")}
                  {selectedDoc.page_count && ` · ${selectedDoc.page_count} pages`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge status={selectedDoc.status} />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5 rounded-lg"
                  onClick={() => handleReprocess(selectedDoc.id, selectedDoc.original_name)}
                  disabled={reprocessing.has(selectedDoc.id)}
                >
                  {reprocessing.has(selectedDoc.id)
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <RotateCcw className="h-3.5 w-3.5" />}
                  {reprocessing.has(selectedDoc.id) ? "Processing…" : "Reprocess"}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select a document</p>
          )}
        </div>

        {/* Search bar for pages */}
        {selectedDoc && (
          <div className="px-5 py-2.5 border-b border-border shrink-0">
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search pages…"
                value={pageSearch}
                onChange={(e) => setPageSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-input bg-muted/50 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring/50 transition-all"
              />
            </div>
          </div>
        )}

        {/* Pages content */}
        <ScrollArea className="flex-1">
          {loadingPages ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Loading pages…</p>
            </div>
          ) : !selectedDoc ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
              <FileText className="h-8 w-8 opacity-30" />
              <p className="text-sm">Select a document to view its pages</p>
            </div>
          ) : filteredPages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
              <FileText className="h-8 w-8 opacity-30" />
              <p className="text-sm">{pageSearch ? "No pages match your search" : "No page content found"}</p>
              {!pageSearch && (
                <p className="text-xs">Click Reprocess to extract text from this document</p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredPages.map((page) => {
                const key = `${selectedId}-${page.id}`;
                const isExpanded = expandedPages.has(key);
                const hasText = !!page.chunk_text;
                return (
                  <div key={page.id} className="px-5 py-3">
                    <button
                      className="w-full flex items-start gap-2 text-left"
                      onClick={() => hasText && togglePage(key)}
                      disabled={!hasText}
                    >
                      <div className="shrink-0 mt-0.5">
                        {!hasText ? (
                          <span className="h-3.5 w-3.5 inline-block" />
                        ) : isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground mb-0.5">
                          Page {page.page_number ?? page.chunk_index + 1}
                        </p>
                        {hasText ? (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {page.chunk_text.slice(0, 220).trim()}
                            {page.chunk_text.length > 220 ? "…" : ""}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Empty page</p>
                        )}
                      </div>
                    </button>

                    {isExpanded && hasText && (
                      <div className="mt-2 ml-5 p-3 rounded-lg bg-muted/50 text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed max-h-96 overflow-auto">
                        {page.chunk_text}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

    </div>
  );
}
