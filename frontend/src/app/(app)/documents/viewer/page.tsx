"use client";
import React, { useState, useEffect } from "react";
import {
  ChevronRight, FileText, Loader2, Download, Search, FileSearch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatFileSize, formatDate, cn } from "@/lib/utils";
import {
  listDocuments,
  type ApiDocument,
} from "@/lib/data/documents";
import { useAuth } from "@/context/auth-context";
import { useProject } from "@/context/project-context";
import { getDocIdsForProject } from "@/lib/project-doc-map";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  completed:  { label: "Completed",  className: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800" },
  processing: { label: "Processing", className: "bg-blue-50   text-blue-700   border border-blue-200   dark:bg-blue-900/20   dark:text-blue-400   dark:border-blue-800" },
  uploaded:   { label: "Uploaded",   className: "bg-amber-50  text-amber-700  border border-amber-200  dark:bg-amber-900/20  dark:text-amber-400  dark:border-amber-800" },
  failed:     { label: "Failed",     className: "bg-red-50    text-red-700    border border-red-200    dark:bg-red-900/20    dark:text-red-400    dark:border-red-800" },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
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

// ── Page ───────────────────────────────────────────────────────────────────────
export default function DocumentViewerPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { selectedProjectId } = useProject();
  const userId = user?.id ?? "";

  const [docs, setDocs]             = useState<ApiDocument[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [signedUrl, setSignedUrl]   = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [search, setSearch]         = useState("");

  // ── Load document list ──────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading || !userId) return;
    listDocuments(userId)
      .then((data) => {
        const filtered = selectedProjectId
          ? data.filter((d) => {
              const ids = getDocIdsForProject(selectedProjectId);
              return d.project_id === selectedProjectId || ids.has(d.id);
            })
          : data;
        setDocs(filtered);
        if (filtered.length > 0) setSelectedId(filtered[0].id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId, authLoading, selectedProjectId]);

  // ── Load PDF on selection ──────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedId) return;
    setLoadingDoc(true);
    setSignedUrl(null);

    fetch(`${API_URL}/api/v1/documents/${selectedId}/signed-url`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSignedUrl(d?.signed_url ?? null))
      .catch(console.error)
      .finally(() => setLoadingDoc(false));
  }, [selectedId]);

  const selectedDoc  = docs.find((d) => d.id === selectedId) ?? null;
  const filteredDocs = docs.filter((d) =>
    d.original_name.toLowerCase().includes(search.toLowerCase()),
  );

  // ── Full-screen states ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-[calc(100vh-112px)] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">Loading documents…</p>
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
          <p className="text-sm text-muted-foreground">Upload documents to view them here.</p>
        </div>
      </div>
    );
  }

  // ── Main layout ─────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-112px)] gap-4 p-4 bg-muted/30 overflow-hidden">

      {/* ══ LEFT SIDEBAR ════════════════════════════════════════════════════════ */}
      <div className="flex flex-col w-[280px] shrink-0 rounded-xl border border-border bg-background shadow-sm overflow-hidden">

        {/* Header */}
        <div className="px-4 py-3 border-b border-border shrink-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2.5">
            Documents ({docs.length})
          </p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search documents…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-input bg-muted/50 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring/50 transition-all"
            />
          </div>
        </div>

        {/* List */}
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
                      "w-full text-left rounded-lg px-3 py-2.5 transition-all duration-150 group",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-foreground",
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Icon */}
                      <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg shrink-0 mt-0.5",
                        active ? "bg-white/15" : "bg-muted",
                      )}>
                        <FileText className={cn(
                          "h-4 w-4",
                          active ? "text-primary-foreground" : "text-muted-foreground",
                        )} />
                      </div>

                      {/* Text */}
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

      {/* ══ CENTRE: PDF VIEWER ══════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 rounded-xl border border-border bg-background shadow-sm overflow-hidden">

        {/* Toolbar — matches TopNav h-14 height */}
        {selectedDoc ? (
          <div className="flex items-center gap-3 h-14 px-5 border-b border-border shrink-0">
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
                {selectedDoc.file_size && ` · ${formatFileSize(selectedDoc.file_size)}`}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <StatusBadge status={selectedDoc.status} />
              {signedUrl && (
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 rounded-lg" asChild>
                  <a href={signedUrl} target="_blank" rel="noopener noreferrer" download>
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </a>
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="h-14 border-b border-border shrink-0" />
        )}

        {/* PDF area */}
        <div className="flex-1 overflow-hidden bg-muted/20">
          {loadingDoc ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Loading document…</p>
            </div>
          ) : signedUrl ? (
            <iframe
              src={`${signedUrl}#toolbar=1&navpanes=1&scrollbar=1`}
              className="w-full h-full border-0"
              title={selectedDoc?.original_name ?? "Document"}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                <FileSearch className="h-8 w-8 text-muted-foreground opacity-50" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Preview unavailable</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Extracted fields are shown in the panel on the right.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>


    </div>
  );
}
